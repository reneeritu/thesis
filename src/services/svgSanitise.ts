/**
 * Server-side SVG sanitiser for uploaded provenance-certificate artwork.
 *
 * We only accept SVG that could plausibly be an art piece — no scripts,
 * no foreign objects, no external references, no animation event handlers.
 * The allow-list below is intentionally tight; if a motif needs something
 * new, add it explicitly rather than loosening globally.
 */

import DOMPurify from 'isomorphic-dompurify';

const SVG_TAGS = [
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'title',
  'desc',
  'metadata',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textpath',
  'clippath',
  'clipPath',
  'mask',
  'filter',
  'fegaussianblur',
  'fecolormatrix',
  'femerge',
  'femergenode',
  'feblend',
  'feoffset',
  'feflood',
  'fecomposite',
  'feturbulence',
  'fedisplacementmap',
  'lineargradient',
  'linearGradient',
  'radialgradient',
  'radialGradient',
  'stop',
  'marker',
  'pattern',
];

const SVG_ATTRS = [
  'id',
  'class',
  'style',
  'viewBox',
  'viewbox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-miterlimit',
  'opacity',
  'mix-blend-mode',
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'markerwidth',
  'markerheight',
  'markerunits',
  'orient',
  'refx',
  'refy',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'fr',
  'fx',
  'fy',
  'xmlns',
  'xmlns:xlink',
  'xlink:href',
  'href',
  'preserveaspectratio',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'alignment-baseline',
  'letter-spacing',
  'baseline-shift',
  'stddeviation',
  'in',
  'in2',
  'result',
  'type',
  'values',
  'mode',
  'operator',
  'k1',
  'k2',
  'k3',
  'k4',
  'basefrequency',
  'numoctaves',
  'seed',
  'stitchtiles',
  'scale',
  'xchannelselector',
  'ychannelselector',
];

/**
 * Sanitise an untrusted SVG string. Returns a safe SVG string, or throws if the
 * payload is obviously hostile (non-SVG root, script tags, etc.).
 */
export function sanitiseSvg(raw: string): string {
  if (typeof raw !== 'string') {
    throw new Error('SVG must be a string');
  }
  const trimmed = raw.trim();
  if (!trimmed.startsWith('<')) {
    throw new Error('SVG must begin with an XML tag');
  }
  if (!/<svg[\s>]/i.test(trimmed)) {
    throw new Error('No <svg> root element found');
  }

  const clean = DOMPurify.sanitize(trimmed, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: SVG_TAGS,
    ADD_ATTR: SVG_ATTRS,
    FORBID_TAGS: ['script', 'foreignObject', 'iframe', 'animate', 'animatetransform', 'animatemotion', 'set'],
    FORBID_ATTR: [
      'onload',
      'onclick',
      'onmouseover',
      'onmouseout',
      'onerror',
      'onfocus',
      'onblur',
      'onchange',
    ],
    KEEP_CONTENT: false,
    RETURN_TRUSTED_TYPE: false,
  });

  const result = typeof clean === 'string' ? clean : String(clean);

  if (!/<svg[\s>]/i.test(result)) {
    throw new Error('SVG stripped out during sanitisation');
  }

  const lower = result.toLowerCase();
  if (
    lower.includes('<script') ||
    lower.includes('javascript:') ||
    lower.includes(' on')
  ) {
    if (/\son[a-z]+\s*=/i.test(result) || lower.includes('<script')) {
      throw new Error('SVG still contains active content after sanitisation');
    }
  }

  return result;
}

/** Soft maximum size for accepted SVG payload (~400 KB). */
export const MAX_SVG_BYTES = 400 * 1024;
