import { CsvDropzone } from "@/components/import/csv-dropzone";

export default function ImportPage() {
  return (
    <section aria-labelledby="import-heading">
      <div className="mb-8">
        <p className="mb-2 text-sm font-semibold text-blue-700">CSV取込</p>
        <h1 id="import-heading" className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          JCB利用明細をアップロード
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          JCBからダウンロードした利用明細CSVを選択してください。
        </p>
      </div>

      <CsvDropzone />
    </section>
  );
}

