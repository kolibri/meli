
import "./Filmstrip.css";

type FilmstripProps = {
    frames: string[];
    alt?: string;
};

export function Filmstrip({
                              frames,
                              alt = "Video filmstrip",
                          }: FilmstripProps) {
    return (
        <div className="filmstrip" role="img" aria-label={alt}>
            {frames.slice(0, 10).map((frame, index) => (
                <img
                    key={`${frame}-${index}`}
                    src={frame}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                />
            ))}
        </div>
    );
}