import { render, screen, waitFor } from "@testing-library/react";

import { BarcodeScanner } from "@/components/BarcodeScanner";

const mockDecodeFromVideoDevice = jest.fn();

jest.mock("@zxing/browser", () => ({
  BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
    decodeFromVideoDevice: (...args: unknown[]) => mockDecodeFromVideoDevice(...args),
  })),
}));

afterEach(() => {
  mockDecodeFromVideoDevice.mockReset();
});

test("FE-019: 読み取り不可(デコード失敗)のコールバックを受けるとエラーメッセージを表示し、再スキャン可能な状態を維持する", async () => {
  mockDecodeFromVideoDevice.mockRejectedValue(new Error("camera unavailable"));

  render(<BarcodeScanner active onDetect={jest.fn()} />);

  await waitFor(() => {
    expect(screen.getByText(/カメラを起動できませんでした/)).toBeInTheDocument();
  });

  // エラー後もコンポーネント自体は表示されたまま(再スキャン可能な状態を維持する)
  expect(document.querySelector("video")).toBeInTheDocument();
});

test("バーコードを正常に検出するとonDetectがデコード結果のテキストで呼ばれる", async () => {
  const onDetect = jest.fn();
  mockDecodeFromVideoDevice.mockImplementation(async (_device, _video, callback) => {
    callback({ getText: () => "0001" });
    return { stop: jest.fn() };
  });

  render(<BarcodeScanner active onDetect={onDetect} />);

  await waitFor(() => {
    expect(onDetect).toHaveBeenCalledWith("0001");
  });
});
