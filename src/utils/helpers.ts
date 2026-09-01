export function formatIndonesianDate(dateInput: Date | string = new Date()): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatIndonesianDateTime(dateInput: Date | string = new Date()): {
  dateFormatted: string;
  timeFormatted: string;
  fullFormatted: string;
} {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const dateFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  const timeFormatted = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date) + ' WIB';

  return {
    dateFormatted,
    timeFormatted,
    fullFormatted: `${dateFormatted}, ${timeFormatted}`,
  };
}

export function generateTransactionNumber(type: 'IN' | 'OUT'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digits
  const prefix = type === 'OUT' ? 'REQ-GA' : 'TRX-IN';
  return `${prefix}-${year}${month}${day}-${randomSuffix}`;
}

export function generateItemCode(categoryPrefix: string = 'ATK'): string {
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `GA-${categoryPrefix.toUpperCase()}-${randomNum}`;
}

export function detectCategoryFromName(name: string): string {
  const lower = name.toLowerCase();

  // ATK (Alat Tulis Kantor)
  if (
    lower.includes('kertas') ||
    lower.includes('hvs') ||
    lower.includes('pulpen') ||
    lower.includes('pen ') ||
    lower.includes('pensil') ||
    lower.includes('spidol') ||
    lower.includes('buku') ||
    lower.includes('binder') ||
    lower.includes('map') ||
    lower.includes('ordner') ||
    lower.includes('staples') ||
    lower.includes('klip') ||
    lower.includes('cutter') ||
    lower.includes('gunting') ||
    lower.includes('penggaris') ||
    lower.includes('amplop') ||
    lower.includes('tipe-x') ||
    lower.includes('koreksi') ||
    lower.includes('tinta') ||
    lower.includes('memo') ||
    lower.includes('post-it')
  ) {
    return 'ATK (Alat Tulis Kantor)';
  }

  // Kebersihan & Sanitasi
  if (
    lower.includes('sapu') ||
    lower.includes('pel') ||
    lower.includes('sabun') ||
    lower.includes('deterjen') ||
    lower.includes('wipol') ||
    lower.includes('soklin') ||
    lower.includes('kanebo') ||
    lower.includes('lap') ||
    lower.includes('ember') ||
    lower.includes('sikat') ||
    lower.includes('pengharum') ||
    lower.includes('stella') ||
    lower.includes('bayfresh') ||
    lower.includes('tisu') ||
    lower.includes('tissue') ||
    lower.includes('sampah') ||
    lower.includes('plastik sampah') ||
    lower.includes('pembersih')
  ) {
    return 'Kebersihan & Sanitasi';
  }

  // K3 & Perlengkapan Medis
  if (
    lower.includes('p3k') ||
    lower.includes('obat') ||
    lower.includes('betadine') ||
    lower.includes('paracetamol') ||
    lower.includes('perban') ||
    lower.includes('plester') ||
    lower.includes('masker') ||
    lower.includes('helm') ||
    lower.includes('safety') ||
    lower.includes('sarung tangan') ||
    lower.includes('earplug') ||
    lower.includes('rompi') ||
    lower.includes('kacamata safety') ||
    lower.includes('antiseptik')
  ) {
    return 'K3 & Perlengkapan Medis';
  }

  // Pantry & Konsumsi
  if (
    lower.includes('kopi') ||
    lower.includes('teh') ||
    lower.includes('gula') ||
    lower.includes('aqua') ||
    lower.includes('air') ||
    lower.includes('mineral') ||
    lower.includes('club') ||
    lower.includes('creamer') ||
    lower.includes('snack') ||
    lower.includes('galon') ||
    lower.includes('dispenser') ||
    lower.includes('cangkir') ||
    lower.includes('gelas') ||
    lower.includes('sendok')
  ) {
    return 'Pantry & Konsumsi';
  }

  // Elektronik & Komputer
  if (
    lower.includes('mouse') ||
    lower.includes('keyboard') ||
    lower.includes('monitor') ||
    lower.includes('printer') ||
    lower.includes('kabel') ||
    lower.includes('charger') ||
    lower.includes('adapter') ||
    lower.includes('flashdisk') ||
    lower.includes('harddisk') ||
    lower.includes('toner') ||
    lower.includes('catridge') ||
    lower.includes('baterai') ||
    lower.includes('stop kontak') ||
    lower.includes('lampu') ||
    lower.includes('hdmi') ||
    lower.includes('lan')
  ) {
    return 'Elektronik & Komputer';
  }

  // Gudang Kayu / Logistik & Pengemasan
  if (
    lower.includes('kayu') ||
    lower.includes('triplek') ||
    lower.includes('papan') ||
    lower.includes('balok') ||
    lower.includes('usuk') ||
    lower.includes('reng') ||
    lower.includes('kaso') ||
    lower.includes('plywood') ||
    lower.includes('mdf') ||
    lower.includes('pallet') ||
    lower.includes('kardus') ||
    lower.includes('lakban') ||
    lower.includes('bubble') ||
    lower.includes('karung')
  ) {
    return 'Logistik & Pengemasan';
  }

  // Maintenance & Perkakas
  if (
    lower.includes('obeng') ||
    lower.includes('tang') ||
    lower.includes('palu') ||
    lower.includes('bor') ||
    lower.includes('gergaji') ||
    lower.includes('meteran') ||
    lower.includes('lem') ||
    lower.includes('kawat') ||
    lower.includes('paku') ||
    lower.includes('baut') ||
    lower.includes('sekrup') ||
    lower.includes('kuas') ||
    lower.includes('cat') ||
    lower.includes('amplas') ||
    lower.includes('pipa') ||
    lower.includes('gembok') ||
    lower.includes('kunci')
  ) {
    return 'Maintenance & Perkakas';
  }

  return 'ATK (Alat Tulis Kantor)';
}

export function generateCategorySKU(
  category: string,
  existingItems: { code: string; name: string }[] = [],
  targetItemName?: string
): string {
  // If targetItemName is provided and exact matching item already exists in database, reuse its SKU code
  if (targetItemName && targetItemName.trim()) {
    const cleanName = targetItemName.trim().toLowerCase();
    const existing = existingItems.find(
      (it) => it.name.trim().toLowerCase() === cleanName
    );
    if (existing && existing.code) {
      return existing.code;
    }
  }

  let prefix = 'GA-GEN-';
  const cat = category || '';

  if (cat.includes('ATK') || cat.includes('Tulis')) {
    prefix = 'GA-ATK-';
  } else if (cat.includes('Kebersihan') || cat.includes('Sanitasi')) {
    prefix = 'GA-KBR-';
  } else if (cat.includes('K3') || cat.includes('Medis')) {
    prefix = 'GA-K3-';
  } else if (cat.includes('Pantry') || cat.includes('Konsumsi')) {
    prefix = 'GA-PNT-';
  } else if (cat.includes('Elektronik') || cat.includes('Komputer')) {
    prefix = 'GA-ELK-';
  } else if (cat.includes('Maintenance') || cat.includes('Perkakas')) {
    prefix = 'GA-MNT-';
  } else if (cat.includes('Logistik') || cat.includes('Pengemasan')) {
    prefix = 'GA-LOG-';
  } else if (cat.includes('Aset') || cat.includes('Peralatan')) {
    prefix = 'GA-AST-';
  }

  // Find all existing items matching this prefix
  let maxSeq = 0;
  existingItems.forEach((it) => {
    if (it.code && it.code.startsWith(prefix)) {
      const numPart = it.code.replace(prefix, '').replace(/[^0-9]/g, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

// Audio synthesizer beep for successful barcode scan
export function playScanBeep(isSuccess: boolean = true) {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isSuccess) {
      // 2-tone pleasant high chirp
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08); // E6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } else {
      // Low alert buzz
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn('Audio playback error', e);
  }
}

export function formatRupiah(amount?: number): string {
  if (amount === undefined || isNaN(amount)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
