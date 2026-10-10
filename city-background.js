// All frames share these pavement heights, independent of the original composition.
export const CITY_ART = { width: 1672, height: 941, sidewalk: 744, curbTop: 824, curbBottom: 849, joinWidth: 512 };

export function cityBands(district) {
  const source = [0, ...district.pavement, CITY_ART.height];
  const target = [0, CITY_ART.sidewalk, CITY_ART.curbTop, CITY_ART.curbBottom, CITY_ART.height];
  return target.slice(0, -1).map((y, index) => ({
    sourceY: source[index], sourceHeight: source[index + 1] - source[index],
    y, height: target[index + 1] - y
  }));
}

const newCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
};

export function alignCityFrame(image, district) {
  const canvas = newCanvas(CITY_ART.width, CITY_ART.height);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  // Keep the curb face separate: its top and bottom must both meet the next frame.
  for (const band of cityBands(district)) {
    context.drawImage(image, 0, band.sourceY, CITY_ART.width, band.sourceHeight,
      0, band.y, CITY_ART.width, band.height);
  }
  return canvas;
}

export function createCityJoin(left, right, column, index) {
  const { width: frameWidth, height, joinWidth: width, sidewalk } = CITY_ART;
  const half = width / 2;
  const canvas = newCanvas(width, height), context = canvas.getContext('2d');
  const overlay = newCanvas(width, height), layer = overlay.getContext('2d');
  context.imageSmoothingEnabled = layer.imageSmoothingEnabled = false;
  // Reflect only the edge textures into the concealed overlap. At the outside
  // edges of this patch the pixels still exactly match the original frames.
  context.drawImage(left, frameWidth - half, 0, half, height, 0, 0, half, height);
  context.save(); context.translate(width, 0); context.scale(-1, 1);
  context.drawImage(left, frameWidth - half, 0, half, height, 0, 0, half, height);
  context.restore();
  layer.save(); layer.translate(half, 0); layer.scale(-1, 1);
  layer.drawImage(right, 0, 0, half, height, 0, 0, half, height);
  layer.restore();
  layer.drawImage(right, 0, 0, half, height, half, 0, half, height);
  layer.globalCompositeOperation = 'destination-in';
  const fade = (start, end, y, bandHeight) => {
    const mask = layer.createLinearGradient(start, 0, end, 0);
    mask.addColorStop(0, 'rgba(0,0,0,0)');
    mask.addColorStop(.25, 'rgba(0,0,0,.15625)');
    mask.addColorStop(.5, 'rgba(0,0,0,.5)');
    mask.addColorStop(.75, 'rgba(0,0,0,.84375)');
    mask.addColorStop(1, 'rgba(0,0,0,1)');
    layer.fillStyle = mask; layer.fillRect(0, y, width, bandHeight);
  };
  // A solid wall pier hides the facade overlap; a wider blend merges wet paving.
  // Mask each band with a clip so destination-in cannot erase the other band.
  layer.save(); layer.beginPath(); layer.rect(0, 0, width, sidewalk); layer.clip();
  fade(half - 48, half + 48, 0, sidewalk); layer.restore();
  layer.save(); layer.beginPath(); layer.rect(0, sidewalk, width, height - sidewalk); layer.clip();
  fade(0, width, sidewalk, height - sidewalk); layer.restore();
  context.drawImage(overlay, 0, 0);
  const columnHeight = 744, columnWidth = 704 * columnHeight / 1490;
  context.save(); context.translate(half, 0);
  if (index % 2) context.scale(-1, 1);
  context.drawImage(column, 160, 0, 704, 1490, -columnWidth / 2, 0, columnWidth, columnHeight);
  context.restore();
  return canvas;
}
