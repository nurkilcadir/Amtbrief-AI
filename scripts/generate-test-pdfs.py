"""Generates sample German official letter PDFs to test the deterministic
risk-scoring rules (deadline_type x consequence_severity -> risk_level) and
the deadline_iso / source_excerpt grounding logic end to end."""

from fpdf import FPDF
from fpdf.enums import XPos, YPos
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "samples", "test-pdfs")
os.makedirs(OUT_DIR, exist_ok=True)

LETTERS = {
    "01-high-risk-zwangsgeld-finanzamt.pdf": {
        "title": "High risk: Zwangsgeld, exclusionary deadline (expect risk_level=high)",
        "body": """Finanzamt Musterstadt
Bearbeitungsstelle Einkommensteuer
Beispielstrasse 5
12345 Musterstadt

Aktenzeichen: FA-2026-118822

Betreff: Mahnung und Androhung eines Zwangsgeldes

Sehr geehrte Damen und Herren,

Sie haben Ihre Einkommensteuererklaerung fuer das Jahr 2024 trotz Erinnerung nicht eingereicht.

Sollten die fehlenden Unterlagen nicht bis zum 10.07.2026 bei uns eingehen, setzen wir ein Zwangsgeld in Hoehe von 500 Euro fest. Diese Frist ist gesetzlich vorgeschrieben und kann nicht verlaengert werden.

Bitte reichen Sie die vollstaendige Steuererklaerung unverzueglich nach, um die Festsetzung des Zwangsgeldes zu vermeiden.

Mit freundlichen Gruessen
Finanzamt Musterstadt""",
    },
    "02-medium-risk-auslaenderbehoerde-termin.pdf": {
        "title": "Medium risk: routine appointment, extendable (expect risk_level=medium)",
        "body": """Auslaenderbehoerde Musterstadt
Fachbereich Aufenthalt
Beispielstrasse 12
12345 Musterstadt

Aktenzeichen: ABH-2026-000471

Betreff: Ihr Antrag auf Verlaengerung des Aufenthaltstitels

Sehr geehrte Antragstellerin, sehr geehrter Antragsteller,

fuer die weitere Bearbeitung Ihres Antrags auf Verlaengerung des Aufenthaltstitels benoetigen wir noch Unterlagen.

Bitte erscheinen Sie am 25.08.2026 um 10:00 Uhr im BuergerService Zentrum, Zimmer 204, Beispielstrasse 12, 12345 Musterstadt.

Bringen Sie bitte folgende Unterlagen mit:
- gueltiger Reisepass
- aktuelles biometrisches Passfoto
- Nachweis ueber ausreichenden Krankenversicherungsschutz
- aktueller Mietvertrag oder Wohnungsgeberbestaetigung

Sollten die Unterlagen nicht vollstaendig vorliegen, kann ueber Ihren Antrag nicht abschliessend entschieden werden. Eine verspaetete Einreichung kann zu Verzoegerungen fuehren.

Falls Sie den Termin nicht wahrnehmen koennen, teilen Sie uns dies bitte rechtzeitig schriftlich mit, damit ein neuer Termin vereinbart werden kann.

Mit freundlichen Gruessen
Auslaenderbehoerde Musterstadt""",
    },
    "03-low-risk-informational-buergeramt.pdf": {
        "title": "Low risk: pure informational notice (expect risk_level=low)",
        "body": """Buergeramt Musterstadt
Beispielstrasse 1
12345 Musterstadt

Betreff: Information ueber geaenderte Oeffnungszeiten

Sehr geehrte Damen und Herren,

wir moechten Sie darueber informieren, dass sich unsere Oeffnungszeiten ab dem 01.09.2026 aendern werden. Das Buergeramt ist ab diesem Datum montags bis freitags von 8:00 bis 16:00 Uhr geoeffnet.

Eine Reaktion oder ein Termin ist hierfuer nicht erforderlich. Bei Fragen koennen Sie sich gerne telefonisch an uns wenden.

Mit freundlichen Gruessen
Buergeramt Musterstadt""",
    },
    "04-high-risk-imminent-deadline-jobcenter.pdf": {
        "title": "High risk: proximity bump, deadline only 2 days out (expect risk_level=high)",
        "body": """Jobcenter Musterstadt
Team 4
Beispielstrasse 9
12345 Musterstadt

Aktenzeichen: JC-2026-554211

Betreff: Aufforderung zur Mitwirkung - Einstellung der Leistung droht

Sehr geehrte Damen und Herren,

zur Pruefung Ihres weiteren Leistungsanspruchs benoetigen wir aktuelle Kontoauszuege der letzten drei Monate.

Bitte reichen Sie die angeforderten Unterlagen bis spaetestens 02.07.2026 ein. Sollten die Unterlagen nicht fristgerecht vorliegen, sind wir gemaess Sozialgesetzbuch verpflichtet, die Leistung vorlaeufig einzustellen.

Mit freundlichen Gruessen
Jobcenter Musterstadt""",
    },
}

TODAY_NOTE = "Generated for testing on 2026-06-30. Letter 04 uses a deadline ~2 days out to test the proximity-bump rule."


def make_pdf(filename: str, title: str, body: str):
    pdf = FPDF(format="A4")
    pdf.set_margins(20, 20, 20)
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    usable_width = pdf.epw
    for line in body.split("\n"):
        if line.strip() == "":
            pdf.ln(4)
        else:
            pdf.multi_cell(
                usable_width,
                6,
                line,
                new_x=XPos.LMARGIN,
                new_y=YPos.NEXT,
                align="L",
            )
    pdf.output(os.path.join(OUT_DIR, filename))
    print(f"wrote {filename}  -- {title}")


if __name__ == "__main__":
    for filename, data in LETTERS.items():
        make_pdf(filename, data["title"], data["body"])
    print(TODAY_NOTE)
