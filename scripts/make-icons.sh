#!/usr/bin/env bash
# Gera ícones web e Android (launcher + splash) a partir de assets/logo.jpg. Requer ImageMagick.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets/logo.jpg
BG='#1a1e21'
RES=android/app/src/main/res

convert "$SRC" -resize 1024x1024 assets/icon-only.png
for s in 192 512; do convert "$SRC" -resize ${s}x${s} public/icon-$s.png; done

# foreground adaptativo: logo a 66% (zona segura) com bordas esmaecidas para fundir com o fundo sólido
foreground() { # tamanho arquivo
  local s=$1 inner=$(( $1 * 66 / 100 )) mask
  mask=$(mktemp --suffix=.png)
  convert -size ${inner}x${inner} xc:black -fill white -draw "rectangle $((inner/8)),$((inner/8)) $((inner*7/8)),$((inner*7/8))" -blur 0x$((inner/12)) "$mask"
  convert "$SRC" -resize ${inner}x${inner} \( "$mask" -alpha off \) -compose CopyOpacity -composite png:- |
    convert png:- -background none -gravity center -extent ${s}x${s} "$2"
  rm -f "$mask"
}

declare -A LAUNCHER=([ldpi]=36 [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192)
for d in "${!LAUNCHER[@]}"; do
  l=${LAUNCHER[$d]}; f=$(( l * 9 / 4 ))
  convert "$SRC" -resize ${l}x${l} $RES/mipmap-$d/ic_launcher.png
  convert "$SRC" -resize ${l}x${l} -alpha set \( +clone -alpha extract -fill black -colorize 100 -fill white -draw "circle $((l/2)),$((l/2)) $((l/2)),0" \) -compose CopyOpacity -composite $RES/mipmap-$d/ic_launcher_round.png
  [ -f $RES/mipmap-$d/ic_launcher_foreground.png ] && foreground $f $RES/mipmap-$d/ic_launcher_foreground.png
done
sed -i "s/#[0-9A-Fa-f]\{6\}/$BG/" $RES/values/ic_launcher_background.xml

splash() { # largura altura arquivo
  local m=$(( $1 < $2 ? $1 : $2 )) logo
  logo=$(( m * 45 / 100 ))
  convert -size ${1}x${2} xc:"$BG" \( "$SRC" -resize ${logo}x${logo} \) -gravity center -composite "$3"
}
splash 480 320 $RES/drawable/splash.png
for f in $RES/drawable-*/splash.png; do
  read -r w h < <(identify -format '%w %h\n' "$f")
  splash "$w" "$h" "$f"
done
