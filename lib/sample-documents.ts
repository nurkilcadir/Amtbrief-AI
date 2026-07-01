export type SampleLetter = {
  id: string;
  title: string;
  authority: string;
  tag: string;
  text: string;
};

export const sampleLetters: SampleLetter[] = [
  {
    id: "auslaenderbehoerde-missing-documents",
    title: "Ausländerbehörde: appointment and missing documents",
    authority: "Ausländerbehörde Musterstadt",
    tag: "Medium risk · Appointment",
    text: `Ausländerbehörde Musterstadt
Fachbereich Aufenthalt
Beispielstraße 12
12345 Musterstadt

Aktenzeichen: ABH-2026-000471

Betreff: Ihr Antrag auf Verlängerung des Aufenthaltstitels

Sehr geehrte Antragstellerin, sehr geehrter Antragsteller,

für die weitere Bearbeitung Ihres Antrags auf Verlängerung des Aufenthaltstitels benötigen wir noch Unterlagen.

Bitte erscheinen Sie am 14.08.2026 um 09:30 Uhr im BürgerService Zentrum, Zimmer 204, Beispielstraße 12, 12345 Musterstadt.

Bringen Sie bitte folgende Unterlagen mit:
- gültiger Reisepass
- aktuelles biometrisches Passfoto
- Nachweis über ausreichenden Krankenversicherungsschutz
- aktueller Mietvertrag oder Wohnungsgeberbestätigung
- Einkommensnachweise der letzten drei Monate oder Immatrikulationsbescheinigung

Sollten die Unterlagen nicht vollständig vorliegen, kann über Ihren Antrag nicht abschließend entschieden werden. Eine verspätete Einreichung kann zu Verzögerungen führen.

Falls Sie den Termin nicht wahrnehmen können, teilen Sie uns dies bitte unverzüglich schriftlich mit.

Mit freundlichen Grüßen
Ausländerbehörde Musterstadt`,
  },
  {
    id: "finanzamt-zwangsgeld-payment",
    title: "Finanzamt: Zwangsgeld warning with bank transfer",
    authority: "Finanzamt Musterstadt",
    tag: "High risk · Payment (IBAN)",
    text: `Finanzamt Musterstadt
Bearbeitungsstelle Einkommensteuer
Beispielstraße 5
12345 Musterstadt

Aktenzeichen: FA-2026-118822

Betreff: Mahnung und Androhung eines Zwangsgeldes

Sehr geehrte Damen und Herren,

Sie haben Ihre Einkommensteuererklärung für das Jahr 2024 trotz Erinnerung nicht eingereicht.

Sollten die fehlenden Unterlagen nicht bis zum 10.07.2026 bei uns eingehen, setzen wir ein Zwangsgeld in Höhe von 500 Euro fest. Bitte überweisen Sie den Betrag von 500 Euro auf folgendes Konto: DE89 3704 0044 0532 0130 00, Verwendungszweck FA-2026-118822. Diese Frist ist gesetzlich vorgeschrieben und kann nicht verlängert werden.

Bitte reichen Sie die vollständige Steuererklärung unverzüglich nach, um die Festsetzung des Zwangsgeldes zu vermeiden.

Mit freundlichen Grüßen
Finanzamt Musterstadt`,
  },
  {
    id: "buergeramt-informational",
    title: "Bürgeramt: change of opening hours",
    authority: "Bürgeramt Musterstadt",
    tag: "Low risk · Informational",
    text: `Bürgeramt Musterstadt
Beispielstraße 1
12345 Musterstadt

Betreff: Information über geänderte Öffnungszeiten

Sehr geehrte Damen und Herren,

wir möchten Sie darüber informieren, dass sich unsere Öffnungszeiten ab dem 01.09.2026 ändern werden. Das Bürgeramt ist ab diesem Datum montags bis freitags von 8:00 bis 16:00 Uhr geöffnet.

Eine Reaktion oder ein Termin ist hierfür nicht erforderlich. Bei Fragen können Sie sich gerne telefonisch an uns wenden.

Mit freundlichen Grüßen
Bürgeramt Musterstadt`,
  },
  {
    id: "jobcenter-status-loss",
    title: "Jobcenter: missing documents, benefits at risk",
    authority: "Jobcenter Musterstadt",
    tag: "High risk · Imminent deadline",
    text: `Jobcenter Musterstadt
Team 4
Beispielstraße 9
12345 Musterstadt

Aktenzeichen: JC-2026-554211

Betreff: Aufforderung zur Mitwirkung - Einstellung der Leistung droht

Sehr geehrte Damen und Herren,

zur Prüfung Ihres weiteren Leistungsanspruchs benötigen wir aktuelle Kontoauszüge der letzten drei Monate.

Bitte reichen Sie die angeforderten Unterlagen bis spätestens 02.07.2026 ein. Sollten die Unterlagen nicht fristgerecht vorliegen, sind wir gemäß Sozialgesetzbuch verpflichtet, die Leistung vorläufig einzustellen.

Mit freundlichen Grüßen
Jobcenter Musterstadt`,
  },
];

export const sampleLetter = sampleLetters[0];

export function getSampleLetterById(id: string) {
  return sampleLetters.find((sample) => sample.id === id) ?? null;
}

export function findSampleLetterByText(text: string) {
  const trimmed = text.trim();
  return sampleLetters.find((sample) => sample.text.trim() === trimmed) ?? null;
}
