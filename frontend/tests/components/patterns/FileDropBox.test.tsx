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

function asFileList(...files: File[]) {
  return Object.assign(files, { item: (index: number) => files[index] ?? null }) as unknown as FileList;
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
    const fileList = asFileList(file);
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

  it("tracks drag enter, drag over, nested drag leave, and drop", () => {
    const onFile = vi.fn();
    const { container } = render(<FileDropBox title="Upload backup" file={null} onFile={onFile} accept=".bak" />, { wrapper: ToastProvider });
    const input = getFileInput(container);
    const surface = input.closest("label");
    if (!surface) throw new Error("drop surface not found");
    const dataTransfer = { files: asFileList(new File(["x"], "backup.bak")), dropEffect: "none" };
    fireEvent.dragEnter(surface, { dataTransfer });
    expect(surface).toHaveAttribute("data-dragging", "true");
    fireEvent.dragLeave(surface, { relatedTarget: document.body });
    expect(surface).not.toHaveAttribute("data-dragging");
    fireEvent.dragOver(surface, { dataTransfer });
    expect(surface).toHaveAttribute("data-dragging", "true");
    const nestedLeave = new Event("dragleave", { bubbles: true, cancelable: true });
    Object.defineProperty(nestedLeave, "relatedTarget", { value: screen.getByText("Upload backup") });
    fireEvent(surface, nestedLeave);
    expect(surface).toHaveAttribute("data-dragging", "true");
    fireEvent.dragLeave(surface, { relatedTarget: document.body });
    expect(surface).not.toHaveAttribute("data-dragging");
    fireEvent.drop(surface, { dataTransfer });
    expect(onFile).toHaveBeenCalledWith(dataTransfer.files.item(0));
  });

  it.each([
    ["an exact MIME type", "application/json", new File(["{}"], "backup.data", { type: "application/json" })],
    ["a wildcard MIME type", "image/*", new File(["x"], "photo.png", { type: "image/png" })],
  ])("accepts %s", (_label, accept, file) => {
    const onFile = vi.fn();
    const { container } = render(<FileDropBox title="Upload" file={null} onFile={onFile} accept={accept} />, { wrapper: ToastProvider });
    const input = getFileInput(container);
    Object.defineProperty(input, "files", { value: asFileList(file), configurable: true });
    fireEvent.change(input);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("accepts any file when no accept pattern is provided", () => {
    const onFile = vi.fn();
    const { container } = render(<FileDropBox title="Upload" file={null} onFile={onFile} />, { wrapper: ToastProvider });
    const file = new File(["x"], "archive.bin", { type: "application/octet-stream" });
    const input = getFileInput(container);
    Object.defineProperty(input, "files", { value: asFileList(file), configurable: true });
    fireEvent.change(input);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("uses the generic rejection message for non-JSON accept patterns", async () => {
    const { container } = render(<FileDropBox title="Upload image" file={null} onFile={vi.fn()} accept="image/*" />, { wrapper: ToastProvider });
    const input = getFileInput(container);
    Object.defineProperty(input, "files", { value: asFileList(new File(["x"], "notes.txt", { type: "text/plain" })), configurable: true });
    fireEvent.change(input);
    expect(await screen.findAllByText("This file type is not accepted.")).not.toHaveLength(0);
  });

  it("disables removing a selected file while busy", () => {
    render(<FileDropBox title="Upload" file={new File([""], "backup.bak")} onFile={vi.fn()} busy />, { wrapper: ToastProvider });
    expect(screen.getByRole("button", { name: "Remove backup.bak" })).toBeDisabled();
  });
});
