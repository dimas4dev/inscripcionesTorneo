export function uploadComprobante(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      reject(new Error('Configuración de Cloudinary incompleta.'));
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', 'torneo-agape-2026/comprobantes');

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        resolve(data.secure_url as string);
      } else {
        reject(new Error('Error al subir el comprobante a Cloudinary.'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Error de red al subir el comprobante.')));

    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/upload`);
    xhr.send(formData);
  });
}
