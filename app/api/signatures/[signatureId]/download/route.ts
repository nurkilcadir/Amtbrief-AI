import { NextResponse } from "next/server";
import { downloadMpowerMedia } from "@/lib/server/mpower";
import { getCurrentUserId } from "@/lib/server/session";
import { getSignatureById } from "@/lib/server/signature-store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ signatureId: string }> },
) {
  const { signatureId } = await context.params;
  const inline = new URL(request.url).searchParams.get("inline") === "1";
  const userId = await getCurrentUserId();
  const signature = await getSignatureById(signatureId);

  if (!signature || signature.userId !== userId) {
    return NextResponse.json({ error: "Signature not found" }, { status: 404 });
  }

  if (signature.status !== "signed" || !signature.mediaId) {
    return NextResponse.json(
      { error: "Signed PDF is not ready yet" },
      { status: 409 },
    );
  }

  try {
    const signedPdf = await downloadMpowerMedia(signature.mediaId);
    console.log(`AmtBrief download: signatureId=${signatureId} mediaId=${signature.mediaId} bytes=${signedPdf.bytes.length}`);

    const signedFileName = signature.fileName.replace(".pdf", "-signed.pdf");
    return new NextResponse(signedPdf.bytes, {
      headers: {
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${signedFileName}"`,
        "Content-Type": signedPdf.contentType,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`AmtBrief download: FAILED signatureId=${signatureId} mediaId=${signature.mediaId} error=${msg}`);
    return NextResponse.json({ error: "PDF download failed", detail: msg }, { status: 502 });
  }
}
