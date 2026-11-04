/**
 * How many appointments the patient missed ("Absent"), as SQL on a patient
 * id column. From a few, the app flags them so the desk can confirm the
 * next booking (the threshold lives in the clinic app).
 */
export const noShowsOf = (patientId: string) =>
  `(select count(*)::int from appointments ns
     where ns.patient_id = ${patientId} and ns.status = 'no_show')`;
