import type { Pool } from '@neondatabase/serverless';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateConversationDto, UpdateConversationDto } from './dto.js';

const PAGE = 50;

const MESSAGE = `x.id, x.body, x.sender_id as "senderId", u.name as "senderName",
  x.created_at as "createdAt"`;

/**
 * Staff chat: direct conversations between two colleagues, named groups,
 * and the whole cabinet's room. Each person only ever reads the
 * conversations they are in; their read, pinned, muted and archived states
 * are their own.
 */
@Injectable()
export class ChatService {
  /**
   * The cabinet's room exists, and everyone is in it: joined on their first
   * visit, with what was written before their account existed already read.
   */
  private async joinCabinetRoom(db: Pool, userId: string) {
    await db.query(
      `insert into conversations (kind) values ('cabinet')
       on conflict (kind) where kind = 'cabinet' do nothing`,
    );
    await db.query(
      `insert into conversation_members (conversation_id, user_id, last_read_at)
       select c.id, u.id, u.created_at from conversations c, users u
        where c.kind = 'cabinet' and u.id = $1
       on conflict do nothing`,
      [userId],
    );
  }

  async list(db: Pool, userId: string) {
    await this.joinCabinetRoom(db, userId);
    const { rows } = await db.query(
      `select c.id, c.kind, c.name, c.created_at as "createdAt",
              coalesce(c.last_message_at, c.created_at) as "activityAt",
              m.pinned_at is not null as pinned,
              m.muted_at is not null as muted,
              (m.archived_at is not null
                and (c.last_message_at is null or c.last_message_at <= m.archived_at)) as archived,
              (select count(*)::int from chat_messages x
                where x.conversation_id = c.id and x.sender_id <> $1
                  and (m.last_read_at is null or x.created_at > m.last_read_at)) as unread,
              (select json_build_object('body', x.body, 'senderId', x.sender_id,
                        'senderName', u.name, 'createdAt', x.created_at)
                 from chat_messages x join users u on u.id = x.sender_id
                where x.conversation_id = c.id
                order by x.created_at desc limit 1) as "lastMessage",
              coalesce((select json_agg(json_build_object('id', u.id, 'name', u.name,
                          'role', u.role, 'active', u.active) order by u.name)
                          from conversation_members o join users u on u.id = o.user_id
                         where o.conversation_id = c.id and o.user_id <> $1), '[]') as members
         from conversations c
         join conversation_members m on m.conversation_id = c.id and m.user_id = $1
        order by (m.pinned_at is not null) desc,
                 coalesce(c.last_message_at, c.created_at) desc`,
      [userId],
    );
    return rows;
  }

  /** Unread messages across the person's conversations, muted ones aside. */
  async unread(db: Pool, userId: string) {
    await this.joinCabinetRoom(db, userId);
    const { rows } = await db.query<{ count: number }>(
      `select count(*)::int from chat_messages x
         join conversation_members m on m.conversation_id = x.conversation_id
        where m.user_id = $1 and m.muted_at is null and x.sender_id <> $1
          and (m.last_read_at is null or x.created_at > m.last_read_at)`,
      [userId],
    );
    return { count: rows[0].count };
  }

  /** The colleagues one may write to: the cabinet's active staff. */
  async people(db: Pool, userId: string) {
    const { rows } = await db.query(
      `select id, name, role from users
        where active and id <> $1 and password_hash is not null
        order by name`,
      [userId],
    );
    return rows;
  }

  async create(db: Pool, userId: string, dto: CreateConversationDto) {
    const others = dto.userIds.filter((id) => id !== userId);
    const { rows: found } = await db.query<{ id: string }>(
      `select id from users where id = any($1::uuid[]) and active`,
      [others],
    );
    if (others.length === 0 || found.length !== others.length) {
      throw new BadRequestException({
        code: 'CHAT_USER_NOT_FOUND',
        message: 'Ce collègue ne fait pas (ou plus) partie de l’équipe.',
      });
    }

    if (others.length === 1) {
      // One conversation per pair: opening it again finds the same one.
      const key = [userId, others[0]].sort().join(':');
      await db.query(
        `insert into conversations (kind, direct_key, created_by)
         values ('direct', $1, $2) on conflict (direct_key) do nothing`,
        [key, userId],
      );
      const { rows } = await db.query<{ id: string }>(
        'select id from conversations where direct_key = $1',
        [key],
      );
      await this.addMembers(db, rows[0].id, [userId, others[0]]);
      await db.query(
        `update conversation_members set archived_at = null
          where conversation_id = $1 and user_id = $2`,
        [rows[0].id, userId],
      );
      return { id: rows[0].id };
    }

    if (!dto.name) {
      throw new BadRequestException({
        code: 'GROUP_NAME_REQUIRED',
        message: 'Donnez un nom au groupe.',
      });
    }
    const { rows } = await db.query<{ id: string }>(
      `insert into conversations (kind, name, created_by)
       values ('group', $1, $2) returning id`,
      [dto.name, userId],
    );
    await this.addMembers(db, rows[0].id, [userId, ...others]);
    return { id: rows[0].id };
  }

  private async addMembers(
    db: Pool,
    conversationId: string,
    userIds: string[],
  ) {
    await db.query(
      `insert into conversation_members (conversation_id, user_id)
       select $1, unnest($2::uuid[]) on conflict do nothing`,
      [conversationId, userIds],
    );
  }

  /** Only members see a conversation; to the others it doesn't exist. */
  private async assertMember(db: Pool, conversationId: string, userId: string) {
    const { rowCount } = await db.query(
      `select 1 from conversation_members
        where conversation_id = $1 and user_id = $2`,
      [conversationId, userId],
    );
    if (!rowCount) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation introuvable.',
      });
    }
  }

  /** The latest messages, or those before `before`; oldest first. */
  async messages(
    db: Pool,
    conversationId: string,
    userId: string,
    before?: string,
  ) {
    await this.assertMember(db, conversationId, userId);
    const { rows } = await db.query(
      `select ${MESSAGE} from chat_messages x join users u on u.id = x.sender_id
        where x.conversation_id = $1
          and ($2::timestamptz is null or x.created_at < $2)
        order by x.created_at desc limit ${PAGE + 1}`,
      [conversationId, before ?? null],
    );
    return {
      messages: rows.slice(0, PAGE).reverse(),
      hasMore: rows.length > PAGE,
    };
  }

  async send(db: Pool, conversationId: string, userId: string, body: string) {
    await this.assertMember(db, conversationId, userId);
    const { rows } = await db.query(
      `with x as (
         insert into chat_messages (conversation_id, sender_id, body)
         values ($1, $2, $3) returning *
       ), touched as (
         update conversations set last_message_at = (select created_at from x),
                updated_at = now() where id = $1
       ), read as (
         update conversation_members set last_read_at = (select created_at from x)
          where conversation_id = $1 and user_id = $2
       )
       select ${MESSAGE} from x join users u on u.id = x.sender_id`,
      [conversationId, userId, body],
    );
    return rows[0];
  }

  async markRead(db: Pool, conversationId: string, userId: string) {
    await this.assertMember(db, conversationId, userId);
    await db.query(
      `update conversation_members set last_read_at = now()
        where conversation_id = $1 and user_id = $2`,
      [conversationId, userId],
    );
  }

  async update(
    db: Pool,
    conversationId: string,
    userId: string,
    dto: UpdateConversationDto,
  ) {
    await this.assertMember(db, conversationId, userId);
    const flag = (on: boolean | undefined, column: string) =>
      on === undefined ? column : on ? `coalesce(${column}, now())` : 'null';
    await db.query(
      `update conversation_members
          set pinned_at = ${flag(dto.pinned, 'pinned_at')},
              muted_at = ${flag(dto.muted, 'muted_at')},
              archived_at = ${dto.archived === undefined ? 'archived_at' : dto.archived ? 'now()' : 'null'}
        where conversation_id = $1 and user_id = $2`,
      [conversationId, userId],
    );
  }
}
