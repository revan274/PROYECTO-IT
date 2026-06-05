import type { Activo } from '../../types/app';
import { escapeHtml } from '../format';
import { resolveAssetBranchCode } from '../assets';

export interface AssetLabelHtmlParams {
  asset: Activo;
  branchCodes: Set<string>;
  qrDataUrl: string;
}

/**
 * Construye el HTML imprimible (60mm x 40mm) de la etiqueta QR de un activo.
 * Función pura: no toca el DOM ni abre ventanas; solo genera la cadena HTML.
 */
export function buildAssetLabelHtml({ asset, branchCodes, qrDataUrl }: AssetLabelHtmlParams): string {
  const tagRaw = String(asset.tag || `ID-${asset.id}`).trim();
  const ubicacionRaw = String(asset.ubicacion || '').trim() || 'Ubicación no registrada';
  const serialRaw = String(asset.serial || '').trim() || 'Sin serie';
  const equipmentRaw = [
    String(asset.equipo || '').trim(),
    String(asset.marca || '').trim(),
    String(asset.modelo || '').trim(),
  ].filter(Boolean).join(' ') || 'Sin especificacion';
  const branchCode = resolveAssetBranchCode(asset, branchCodes);
  const branchRaw = branchCode || String(asset.departamento || '').trim().toUpperCase();
  const ubicacionFullRaw = [branchRaw, ubicacionRaw]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(' | ') || ubicacionRaw;
  const idAssetRaw = String(asset.id || 'N/D');
  const internalCodeSourceRaw = String(asset.idInterno || '').trim() || idAssetRaw;
  const internalCodeDigits = (internalCodeSourceRaw.match(/\d+/g) || []).join('');
  const internalCodeRaw = (internalCodeDigits || String(asset.id || '0')).slice(-2).padStart(2, '0');
  const headerLabelRaw = 'Activo IT';
  const brandLabelRaw = 'Los Gigantes';
  const footerNoteRaw = 'Escanea para identificar';

  const tag = escapeHtml(tagRaw);
  const ubicacion = escapeHtml(ubicacionFullRaw);
  const serial = escapeHtml(serialRaw);
  const equipo = escapeHtml(equipmentRaw);
  const idAsset = escapeHtml(idAssetRaw);
  const headerLabel = escapeHtml(headerLabelRaw);
  const brandLabel = escapeHtml(brandLabelRaw);
  const footerNote = escapeHtml(footerNoteRaw);
  const internalCode = escapeHtml(internalCodeRaw);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta QR ${tag}</title>
  <style>
    @page { size: 60mm 40mm; margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 60mm;
      height: 40mm;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #ffffff;
      color: #0f172a;
    }
    * {
      box-sizing: border-box;
    }
    .label {
      width: 60mm;
      height: 40mm;
      padding: 1.3mm 1.35mm 1.15mm;
      border: 0.25mm solid #111827;
      border-radius: 1.2mm;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background:
        linear-gradient(180deg, #fff7ed 0, #fff7ed 5.8mm, #ffffff 5.8mm, #ffffff 100%);
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1mm;
      margin-bottom: 1mm;
    }
    .header-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35mm;
    }
    .eyebrow {
      margin: 0;
      font-size: 2.95pt;
      font-weight: 900;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #f97316;
      line-height: 1;
    }
    .brand {
      margin: 0;
      font-size: 5.8pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .brand-sub {
      margin: 0;
      font-size: 3pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
    }
    .code-chip {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 10.8mm;
      height: 4.9mm;
      padding: 0 1.35mm;
      border-radius: 999px;
      background: #111827;
      color: #ffffff;
      font-size: 3.25pt;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .main {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 21.2mm;
      gap: 1.3mm;
      align-items: stretch;
    }
    .details {
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 0.65mm;
    }
    .tag-wrap {
      min-width: 0;
      padding: 0.75mm 0.95mm 0.8mm;
      border: 0.18mm solid #e2e8f0;
      border-radius: 0.95mm;
      background: #ffffff;
    }
    .tag-caption {
      margin: 0 0 0.35mm;
      font-size: 2.7pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #94a3b8;
    }
    .tag {
      margin: 0;
      font-size: 10.9pt;
      font-weight: 900;
      line-height: 0.92;
      letter-spacing: 0.01em;
      text-transform: uppercase;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 10.6mm;
      max-height: 11.8mm;
      color: #0f172a;
    }
    .detail-grid {
      min-width: 0;
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.55mm;
    }
    .detail-card {
      min-width: 0;
      border: 0.18mm solid #dbe2ea;
      border-radius: 0.9mm;
      padding: 0.7mm 0.85mm;
      background: #f8fafc;
    }
    .detail-k {
      margin: 0 0 0.28mm;
      font-size: 2.75pt;
      line-height: 1;
      font-weight: 900;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #64748b;
    }
    .detail-v {
      margin: 0;
      font-size: 4.55pt;
      line-height: 1.04;
      font-weight: 900;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #0f172a;
    }
    .equipment {
      min-width: 0;
      margin: 0;
      font-size: 3.35pt;
      line-height: 1.1;
      font-weight: 900;
      text-transform: uppercase;
      color: #475569;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 4.2mm;
    }
    .qr-panel {
      min-height: 0;
      border: 0.22mm solid #111827;
      border-radius: 1.05mm;
      background: #ffffff;
      padding: 0.8mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 0.6mm;
    }
    .qr-frame {
      flex: 1;
      width: 100%;
      min-height: 0;
      border: 0.16mm solid #cbd5e1;
      border-radius: 0.8mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.55mm;
      background: #ffffff;
    }
    .qr {
      width: 19.2mm;
      height: 19.2mm;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
    .qr-label {
      margin: 0;
      font-size: 2.8pt;
      line-height: 1;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #64748b;
    }
    .scan-pill {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 4.1mm;
      padding: 0 1mm;
      border-radius: 999px;
      background: #f97316;
      color: #ffffff;
      font-size: 2.95pt;
      font-weight: 900;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .footer {
      margin-top: auto;
      padding-top: 0.6mm;
      border-top: 0.16mm solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.8mm;
    }
    .footer-note {
      flex: 1;
      min-width: 0;
      margin: 0;
      font-size: 3.1pt;
      line-height: 1.05;
      font-weight: 900;
      text-transform: uppercase;
      color: #475569;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .id-chip {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 11.1mm;
      height: 4.5mm;
      padding: 0 1.25mm;
      border-radius: 999px;
      background: #111827;
      color: #ffffff;
      font-size: 3.25pt;
      font-weight: 900;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="header">
      <div class="header-copy">
        <p class="eyebrow">${headerLabel}</p>
        <p class="brand">${brandLabel}</p>
        <p class="brand-sub">Mesa IT</p>
      </div>
      <span class="code-chip">#${internalCode}</span>
    </div>
    <div class="main">
      <div class="details">
        <div class="tag-wrap">
          <p class="tag-caption">Tag del activo</p>
          <p class="tag">${tag}</p>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <p class="detail-k">Serie</p>
            <p class="detail-v">${serial}</p>
          </div>
          <div class="detail-card">
            <p class="detail-k">Ubicación</p>
            <p class="detail-v">${ubicacion}</p>
          </div>
        </div>
        <p class="equipment">${equipo}</p>
      </div>
      <div class="qr-panel">
        <p class="qr-label">QR firmado</p>
        <div class="qr-frame">
          <img class="qr" src="${qrDataUrl}" alt="QR ${tag}" />
        </div>
        <span class="scan-pill">Escanear</span>
      </div>
    </div>
    <div class="footer">
      <p class="footer-note">${footerNote}</p>
      <span class="id-chip">ID ${idAsset}</span>
    </div>
  </div>
</body>
</html>`;
}
