"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import {
  getJcbCsvErrorMessage,
  parseJcbCsvText,
  readJcbCsvFile,
} from "@/lib/csv/parse-jcb-csv";
import { classifyTransactions } from "@/lib/categories/classify-transactions";
import { useTransactions } from "@/state/transaction-context";

type CsvFileState = {
  file: File | null;
  error: string | null;
};

type ProcessingStage = "idle" | "parsing" | "classifying";

const initialFileState: CsvFileState = {
  file: null,
  error: null,
};

function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  }

  if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateCsvFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return "CSVファイルを選択してください。";
  }

  if (file.size === 0) {
    return "空のCSVファイルは読み込めません。";
  }

  return null;
}

export function CsvDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileState, setFileState] = useState<CsvFileState>(initialFileState);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>("idle");
  const isProcessingRef = useRef(false);
  const { setTransactions } = useTransactions();

  const handleFile = (file: File | null) => {
    if (file === null) {
      return;
    }

    const error = validateCsvFile(file);
    setFileState(error ? { file: null, error } : { file, error: null });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleImport = async () => {
    if (fileState.file === null || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setProcessingStage("parsing");
    setFileState((current) => ({ ...current, error: null }));

    let classificationStarted = false;
    try {
      const csvText = await readJcbCsvFile(fileState.file);
      const parsedTransactions = parseJcbCsvText(csvText);
      classificationStarted = true;
      setProcessingStage("classifying");
      const transactions = await classifyTransactions(parsedTransactions, {
        storage: window.localStorage,
      });
      setTransactions(transactions);
      router.push("/");
    } catch (error) {
      setFileState((current) => ({
        ...current,
        error: classificationStarted
          ? "利用先の分類に失敗しました。もう一度お試しください。"
          : getJcbCsvErrorMessage(error),
      }));
    } finally {
      isProcessingRef.current = false;
      setProcessingStage("idle");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-8">
      <div
        className={`flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-12 text-center transition-colors ${
          isDragging ? "border-blue-600 bg-blue-50" : "border-slate-300 bg-slate-50"
        }`}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm" aria-hidden="true">
          ↥
        </div>
        <p className="text-lg font-bold text-slate-900">CSVをここにドロップ</p>
        <p className="my-3 text-sm text-slate-500">または</p>
        <input
          ref={inputRef}
          id="csv-file"
          className="sr-only"
          type="file"
          accept=".csv,text/csv"
          onChange={handleInputChange}
        />
        <button
          type="button"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 transition hover:border-blue-600 hover:text-blue-700"
          onClick={() => inputRef.current?.click()}
        >
          ファイルを選択
        </button>
        <p className="mt-4 text-xs text-slate-500">CSV形式のファイルを選択できます</p>
      </div>

      {fileState.error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
          <p className="font-semibold text-red-800">CSVファイルを処理できませんでした</p>
          <p className="mt-1 text-sm text-red-700">{fileState.error}</p>
        </div>
      ) : null}

      {fileState.file ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4" aria-live="polite">
          <p className="text-sm font-semibold text-emerald-900">選択されたファイル</p>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-all font-medium text-slate-900">{fileState.file.name}</p>
            <p className="shrink-0 text-sm text-slate-600">{formatFileSize(fileState.file.size)}</p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="mt-6 min-h-12 w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        disabled={fileState.file === null || processingStage !== "idle"}
        onClick={handleImport}
      >
        {processingStage === "parsing"
          ? "CSVを解析しています..."
          : processingStage === "classifying"
            ? "利用先を分類しています..."
            : "このCSVを読み込む"}
      </button>
    </div>
  );
}
