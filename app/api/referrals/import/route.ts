import { database } from "@/lib/db";
import { getAdmin } from "@/lib/session";
import { importReferralWorkbook, ReferralImportError } from "@/lib/referral-import";
import { MAX_IMPORT_BYTES } from "@/lib/referral-import-format";

export async function POST(request: Request) {
  if (!(await getAdmin())) return Response.json({ message: "Your session has expired. Sign in again." }, { status: 401 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  if (Number(request.headers.get("content-length")) > MAX_IMPORT_BYTES + 65536)
    return Response.json({ message: "Choose an Excel file up to 3 MB." }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !/\.(xlsx|xls|xlsm)$/i.test(file.name))
      throw new ReferralImportError("Choose a .xlsx, .xls, or .xlsm workbook.");
    if (file.size > MAX_IMPORT_BYTES) throw new ReferralImportError("Choose an Excel file up to 3 MB.");
    const company = form.get("company");
    const count = await importReferralWorkbook(database(), new Uint8Array(await file.arrayBuffer()), file.name, typeof company === "string" ? company.trim() : "");
    return Response.json({ message: `Imported ${count} candidate row${count === 1 ? "" : "s"}. One referral was created per job ID, or one per row without job IDs.` });
  } catch (error) {
    return Response.json({ message: error instanceof ReferralImportError ? `${error.message} No rows were saved.` : "The import failed. No rows were saved. Please try again." }, { status: error instanceof ReferralImportError ? 400 : 500 });
  }
}
