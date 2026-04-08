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

    // Support for Indian Languages
    const indicFonts = [
        { family: 'Mukta', file: 'Mukta-Regular.ttf' },
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
