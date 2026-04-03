export const fetchAndCompressImage = async (imageUrl, maxWidth = 800) => {
    try {
        // Fetch the image as a blob to bypass some strict rendering checks
        const response = await fetch(imageUrl, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();

        if (!blob.type.startsWith('image/')) {
            console.warn(`Fetched resource is not an image (type: ${blob.type}), returning null`);
            return null;
        }

        return await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } catch (e) {
                    reject(new Error(`Canvas processing failed: ${e.message}`));
                }
            };
            img.onerror = () => reject(new Error('Image failed to load in browser context'));
            img.src = URL.createObjectURL(blob);
        });
    } catch (error) {
        console.warn("Failed to load/compress image for PDF:", error.message);
        return null;
    }
};