import {
    useEffect,
    useRef
} from "react";


import {
    RefreshCw
} from "lucide-react";


import "./Captcha.css";


const WIDTH = 168;
const HEIGHT = 46;

const GLYPH_COLORS = [
    "#97144d",
    "#7c0f3f",
    "#343a4c",
    "#4d5468",
    "#b81f68"
];


function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}


function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}


function drawCaptcha(canvas, code) {

    const ratio = window.devicePixelRatio || 1;

    // Back the canvas with real device pixels so the glyphs stay crisp.
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        return;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#fbf7f9";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);


    // Speckle - light enough to stay readable, busy enough to break up
    // a flat background for naive pixel matching.
    for (let index = 0; index < 44; index += 1) {

        ctx.fillStyle = `rgba(151, 20, 77, ${randomBetween(0.06, 0.2)})`;

        ctx.beginPath();
        ctx.arc(
            randomBetween(0, WIDTH),
            randomBetween(0, HEIGHT),
            randomBetween(0.6, 1.7),
            0,
            Math.PI * 2
        );
        ctx.fill();

    }


    // Wavy strike-through lines behind the text
    for (let index = 0; index < 3; index += 1) {

        ctx.strokeStyle = `rgba(77, 84, 104, ${randomBetween(0.14, 0.3)})`;
        ctx.lineWidth = randomBetween(0.8, 1.6);

        ctx.beginPath();
        ctx.moveTo(0, randomBetween(0, HEIGHT));
        ctx.bezierCurveTo(
            randomBetween(0, WIDTH), randomBetween(0, HEIGHT),
            randomBetween(0, WIDTH), randomBetween(0, HEIGHT),
            WIDTH, randomBetween(0, HEIGHT)
        );
        ctx.stroke();

    }


    // Glyphs - each one jittered, rotated, skewed and recoloured
    const step = WIDTH / (code.length + 1);

    code.split("").forEach((character, index) => {

        ctx.save();

        ctx.translate(
            step * (index + 1) + randomBetween(-3, 3),
            HEIGHT / 2 + randomBetween(-3, 3)
        );

        ctx.rotate(randomBetween(-0.33, 0.33));
        ctx.transform(1, randomBetween(-0.12, 0.12), randomBetween(-0.2, 0.2), 1, 0, 0);

        ctx.font = `700 ${randomBetween(23, 29)}px "Inter", "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = pick(GLYPH_COLORS);

        ctx.fillText(character, 0, 0);

        ctx.restore();

    });


    // A couple of foreground threads across the glyphs
    for (let index = 0; index < 2; index += 1) {

        ctx.strokeStyle = `rgba(151, 20, 77, ${randomBetween(0.2, 0.38)})`;
        ctx.lineWidth = randomBetween(0.9, 1.5);

        ctx.beginPath();
        ctx.moveTo(randomBetween(0, WIDTH * 0.3), randomBetween(0, HEIGHT));
        ctx.lineTo(randomBetween(WIDTH * 0.7, WIDTH), randomBetween(0, HEIGHT));
        ctx.stroke();

    }

}


function Captcha({ code, onRefresh }) {

    const canvasRef = useRef(null);


    useEffect(() => {

        if (canvasRef.current) {
            drawCaptcha(canvasRef.current, code);
        }

    }, [code]);


    return (

        <div className="captcha-box">

            <canvas
                ref={canvasRef}
                className="captcha-canvas"
                width={WIDTH}
                height={HEIGHT}
                role="img"
                aria-label="Security code image. Use the refresh button for a different code."
            />

            <button
                type="button"
                className="captcha-refresh"
                onClick={onRefresh}
                aria-label="Get a new security code"
                title="Get a new code"
            >
                <RefreshCw size={15} />
            </button>

        </div>

    );

}


export default Captcha;
