/** Offers a text as a file download, through a temporary link to an in-memory blob. */
export function downloadTextFile(fileName: string, text: string, mediaType = "text/csv"): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${mediaType};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
