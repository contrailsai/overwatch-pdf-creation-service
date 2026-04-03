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

    Font.registerEmojiSource({
        format: 'png',
        url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/'
    });

    fontsRegistered = true;
};
