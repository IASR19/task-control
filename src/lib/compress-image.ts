export function compressImage(file: File, maxEdge = 1600, quality = 0.72) {
  return new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas indisponível"));
        return;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(url);
      resolve({ base64, mimeType: "image/jpeg" });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não deu para ler essa imagem."));
    };
    image.src = url;
  });
}
