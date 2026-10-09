
export type Video = {
    id: number;
    filename: string;
    sizeBytes: number;
    durationSeconds: number;
    rating: number;
    tags: string[];
    frames: string[];
};

const palettes = [
    ["#273449", "#49617b", "#9e7156"],
    ["#34352c", "#6c7650", "#c3a66d"],
    ["#3a2838", "#81506c", "#c68c84"],
    ["#233b3d", "#477c78", "#9ab8a0"],
];

function makeFrame(index: number, frame: number) {
    const [a, b, c] = palettes[index % palettes.length];
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90">
      <defs>
        <linearGradient id="g" x2="1" y2="1">
          <stop stop-color="${a}"/>
          <stop offset="1" stop-color="${b}"/>
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill="url(#g)"/>
      <circle cx="${25 + frame * 12}" cy="30" r="24" fill="${c}" opacity=".8"/>
      <path d="M0 75 L45 35 L82 72 L115 43 L160 80 V90 H0Z"
        fill="#10141b" opacity=".7"/>
      <text x="8" y="17" fill="white" font-size="9"
        opacity=".8">FRAME ${frame + 1}</text>
    </svg>`;

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const videos: Video[] = Array.from(
    { length: 1500 },
    (_, i) => ({
        id: i + 1,
        filename: `Example Video ${String(i + 1).padStart(5, "0")}.mkv`,
        sizeBytes: 350_000_000 + ((i * 7919) % 8_000_000_000),
        durationSeconds: 300 + ((i * 137) % 10_000),
        rating: i % 6,
        tags: [
            ["Drama", "Favorite"],
            ["Sci-Fi"],
            ["Documentary", "Nature"],
            ["Comedy"],
            ["Thriller", "Rewatch"],
        ][i % 5],
        frames: Array.from(
            { length: 10 },
            (_, frame) => makeFrame(i, frame),
        ),
    }),
);