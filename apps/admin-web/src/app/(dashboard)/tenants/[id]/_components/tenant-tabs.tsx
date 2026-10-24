"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["informations", "subscription", "features", "technical", "audit"] as const;

/**
 * The cabinet page's tabs (Scenario B), kept in `?tab=`. Only the tabs whose
 * data exists ship now; Utilisateurs, Stockage and Facturation come with the
 * modules that own them. `technical` is omitted without technical:read.
 */
export function TenantTabs({
	informations,
	subscription,
	features,
	technical,
	audit,
}: {
	informations: React.ReactNode;
	subscription?: React.ReactNode;
	features?: React.ReactNode;
	technical?: React.ReactNode;
	audit: React.ReactNode;
}) {
	const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("informations"));

	return (
		<Tabs value={tab} onValueChange={(value) => setTab(value as (typeof TABS)[number])}>
			<TabsList>
				<TabsTrigger value="informations">Informations</TabsTrigger>
				{subscription && <TabsTrigger value="subscription">Abonnement</TabsTrigger>}
				{features && <TabsTrigger value="features">Fonctionnalités</TabsTrigger>}
				{technical && <TabsTrigger value="technical">Technique</TabsTrigger>}
				<TabsTrigger value="audit">Audit</TabsTrigger>
			</TabsList>
			<TabsContent value="informations">{informations}</TabsContent>
			{subscription && <TabsContent value="subscription">{subscription}</TabsContent>}
			{features && <TabsContent value="features">{features}</TabsContent>}
			{technical && <TabsContent value="technical">{technical}</TabsContent>}
			<TabsContent value="audit">{audit}</TabsContent>
		</Tabs>
	);
}
