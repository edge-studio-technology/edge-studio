import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileDropBox } from "../../../src/components/patterns/FileDropBox";
import { ToastProvider } from "../../../src/components/ToastProvider";

function getFileInput(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error("file input not found");
  return input as HTMLInputElement;
}

describe("FileDropBox", () => {
  it("renders the title and upload instructions when no file is selected", () => {
    render(<FileDropBox title="Upload backup" file={null} onFile={vi.fn()} />, {
      wrapper: ToastProvider,
    });

    expect(screen.getByText("Upload backup")).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop files/)).toBeInTheDocument();
  });

  it("calls onFile with an accepted file", async () => {
    const onFile = vi.fn();
    const { container } = render(
      <FileDropBox title="Upload backup" file={null} onFile={onFile} accept=".json" />,
      { wrapper: ToastProvider },
    );

    const file = new File(['{"a":1}'], "backup.json", { type: "application/json" });
    await userEvent.upload(getFileInput(container), file);

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("rejects a file that does not match accept and shows an error", async () => {
    const onFile = vi.fn();
    const { container } = render(
      <FileDropBox title="Upload backup" file={null} onFile={onFile} accept=".json" />,
      { wrapper: ToastProvider },
    );

    const file = new File(["binary"], "backup.zip", { type: "application/zip" });
    const input = getFileInput(container);
    const fileList = Object.assign([file], { item: (index: number) => [file][index] ?? null });
    Object.defineProperty(input, "files", { value: fileList, configurable: true });
    fireEvent.change(input);

    expect(onFile).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getAllByText("Only JSON files are accepted.").length).toBeGreaterThan(0);
    });
  });

  it("shows the selected file name and calls onFile(null) when removed", async () => {
    const onFile = vi.fn();
    render(<FileDropBox title="Upload backup" file={new File([""], "backup.json")} onFile={onFile} />, {
      wrapper: ToastProvider,
    });

    expect(screen.getByText("backup.json")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove backup.json" }));
    expect(onFile).toHaveBeenCalledWith(null);
  });
});
