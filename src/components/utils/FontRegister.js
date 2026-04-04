import { Font } from '@react-pdf/renderer';
import path from 'path';

let fontsRegistered = false;

export const registerFonts = () => {
    if (fontsRegistered) return;

    Font.register({
        family: 'Outfit',
        fonts: [
            { src: path.join(__dirname, '../../../public/fonts/Outfit-Regular.ttf') },
            { src: path.join(__dirname, '../../../public/fonts/Outfit-Bold.ttf'), fontWeight: 'bold' },
            { src: path.join(__dirname, '../../../public/fonts/Outfit-Medium.ttf'), fontWeight: 'medium' },
        ]
    });

    // Support for Indian Languages & Urdu
    const indicFonts = [
        { family: 'Noto Sans Devanagari', file: 'NotoSansDevanagari-Regular.ttf' },
        { family: 'Noto Sans Tamil', file: 'NotoSansTamil-Regular.ttf' },
        { family: 'Noto Sans Arabic', file: 'NotoSansArabic-Regular.ttf' }, // Urdu
        { family: 'Noto Sans Gurmukhi', file: 'NotoSansGurmukhi-Regular.ttf' }, // Punjabi
        { family: 'Noto Sans Gujarati', file: 'NotoSansGujarati-Regular.ttf' },
        { family: 'Noto Sans Bengali', file: 'NotoSansBengali-Regular.ttf' },
    ];

    indicFonts.forEach(({ family, file }) => {
        Font.register({
            family,
            src: path.join(__dirname, `../../../public/fonts/${file}`)
        });
    });

    // Emoji Support - Point to the local directory (no network latency)
    // The trailing slash is required for react-pdf to construct the path correctly.
    Font.registerEmojiSource({
        format: 'png',
        url: path.join(__dirname, '../../../public/fonts/emojis') + '/'
    });

    fontsRegistered = true;
};
