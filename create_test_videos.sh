
#!/usr/bin/env bash
set -euo pipefail

OUT="./test-library"
mkdir -p "$OUT"

for i in $(seq 1 30); do
  DURATION=$((10 + (i % 5) * 7))
  WIDTH=640
  HEIGHT=360

  case $((i % 3)) in
    1) WIDTH=1280; HEIGHT=720 ;;
    2) WIDTH=854; HEIGHT=480 ;;
  esac

  echo "Generating video $i/30..."

  if (( i % 2 == 0 )); then
    # Moving test pattern plus a synthetic audio tone
    ffmpeg -hide_banner -loglevel error -y \
      -f lavfi -i "testsrc2=size=${WIDTH}x${HEIGHT}:rate=24" \
      -f lavfi -i "sine=frequency=$((200 + i * 25)):sample_rate=44100" \
      -t "$DURATION" \
      -c:v libx264 -preset ultrafast -crf 28 \
      -pix_fmt yuv420p \
      -c:a aac -shortest \
      "$OUT/test-video-$(printf '%03d' "$i").mp4"
  else
    # Colored moving pattern, video only
    ffmpeg -hide_banner -loglevel error -y \
      -f lavfi -i "testsrc=size=${WIDTH}x${HEIGHT}:rate=24" \
      -t "$DURATION" \
      -c:v libx264 -preset ultrafast -crf 28 \
      -pix_fmt yuv420p \
      "$OUT/test-video-$(printf '%03d' "$i").mp4"
  fi
done

echo "Done. Test videos are in: $OUT"