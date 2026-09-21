"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

interface Props {
  active: boolean;
  onDetect: (rawText: string) => void;
}

/**
 * カメラでのバーコード読み取り(要件3.3.2節)。
 * 認識したテキストはそのまま呼び出し元へ渡す(4桁/8桁の判別・妥当性チェックは
 * lib/barcode.tsのclassifyBarcode()が担当する)。
 * デコードできないフレームは常時発生する(NotFoundException等)ため、それ自体は
 * エラー表示しない。実際に「読み取れませんでした」を表示すべきケース
 * (桁数不一致等)は呼び出し元(POSメイン画面)で判定する(決定事項No.35)。
 */
export function BarcodeScanner({ active, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (result) {
          onDetect(result.getText());
        }
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
        } else {
          controlsRef.current = controls;
          setCameraError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError("カメラを起動できませんでした。カメラへのアクセスを許可してください。");
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [active, onDetect]);

  if (!active) return null;

  return (
    <div className="rounded border p-2">
      <video ref={videoRef} className="w-full max-w-xs" muted playsInline />
      {cameraError && <p className="mt-2 text-sm text-red-600">{cameraError}</p>}
    </div>
  );
}
