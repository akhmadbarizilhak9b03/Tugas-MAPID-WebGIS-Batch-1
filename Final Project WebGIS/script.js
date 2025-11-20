//MEMBUAT MODE GELAP PADA HALAMAN WEBGIS
document.addEventListener("DOMContentLoaded", () => {
    const darkMode = localStorage.getItem("darkMode");
    const toggleButton = document.querySelector(".dark-toggle");

    console.log("Dark mode:", darkMode); // Debug
    console.log("Tombol:", toggleButton); // Debug

    if (darkMode === "enabled") {
        document.body.classList.add("dark-mode");
        if (toggleButton) toggleButton.textContent = "☀️";
    } else {
        if (toggleButton) toggleButton.textContent = "🌙";
    }

    if (toggleButton) {
        toggleButton.addEventListener("click", () => {
            document.body.classList.toggle("dark-mode");
            const isDark = document.body.classList.contains("dark-mode");
            toggleButton.textContent = isDark ? "☀️" : "🌙";
            localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
        });
    }
});







// 🗺️ Inisialisasi Peta
const MAP_SERVICE_KEY = "68da7e8106823ed3f510cc4a";
const DEFAULT_THEME = "street-2d-building";

const map = new maplibregl.Map({
    container: "map",
    style: `https://basemap.mapid.io/styles/${DEFAULT_THEME}/style.json?key=${MAP_SERVICE_KEY}`,
    center: [113.34467232786119, -7.048973073910204],
    zoom: 9,
    attributionControl: true,
    canvasContextAttributes: { antialias: true },
});

// 🔁 Variabel global DITAMBAHKAN
let isokronVisible = false;
let hasilIsokron = null; // Menyimpan data GeoJSON polygon isokron terakhir
let hasilIsokronTitik = null; // Menyimpan data GeoJSON titik hasil isokron terakhir
let selectedCenterPoint = [113.482662646211, -7.160562247162545]; // 🆕 Koordinat default
let mapSelectMarker = null; // 🆕 Marker untuk titik yang diklik pengguna
const MAP_SELECT_COLOR = "#8B5CF6"; // Warna Ungu untuk titik pilihan pengguna (Pusat Isokron)

// 🆕 FUNGSI PEMBANTU BARU: Membuat delay menggunakan Promise
const delay = ms => new Promise(res => setTimeout(res, ms));


// <<< PERUBAHAN 1: Ikon SVG Pembantu & FUNGSI KOMPOSIT BARU >>>
// 🔸 Fungsi Pembantu untuk Membuat Ikon SVG MARKER DASAR (untuk ikon kategori wisata)
const createBaseMarkerSvg = (color) => {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="${color}" stroke="white" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="5"/>
               </svg>`;
};
const ISOCHRONE_HIGHLIGHT_ID = "custom-marker-orange-numbered"; // ID UNIK UNTUK IKON KOMPOSIT

// 🎨 FUNGSI BARU UNTUK IKON KOMPOSIT (Marker Keren)
// 🟢 PERBAIKAN STYLE DIKEMBALIKAN: markerColor = Oranye, boxColor = Biru, textColor = Putih
// (Menggunakan nilai default yang sesuai dengan gaya sebelumnya)
const createNumberedMarkerSvg = (number, markerColor = "#f97316", boxColor = "#3B82F6", textColor = "white") => {
    // Dimensi dan Posisi SVG dihitung agar ujung marker berada tepat di titik koordinat
    const width = 48;
    const height = 48;

    // Posisi Marker: Ujung marker di y=40
    const markerX = 14;
    const markerCenterY = 28;
    const markerRadius = 5;

    // Posisi Kotak Angka (di kanan atas)
    const boxWidth = 22;
    const boxHeight = 22;
    const boxX = 24;
    const boxY = 2;

    // Titik Garis Penghubung (dari leher marker ke sudut kotak)
    const lineStartX = markerX + 4;
    const lineStartY = markerCenterY - 4;
    const lineEndX = boxX + 2;
    const lineEndY = boxY + 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                
        <line x1="${lineStartX}" y1="${lineStartY}" x2="${lineEndX}" y2="${lineEndY}" 
                stroke="black" stroke-width="2" stroke-linecap="round"/>
                
        <path d="M${markerX + 9} ${markerCenterY}c0 7-9 13-9 13S${markerX - 9} ${markerCenterY + 6} ${markerX - 9} ${markerCenterY}a9 9 0 0 1 18 0z" fill="${markerColor}" stroke="white" stroke-width="2"/>
        <circle cx="${markerX}" cy="${markerCenterY}" r="${markerRadius}" fill="${markerColor}" stroke="white" stroke-width="2"/>
                
        <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="4" ry="4" 
                    fill="${boxColor}" stroke="black" stroke-width="2"/>

        <text x="${boxX + boxWidth / 2}" y="${boxY + boxHeight / 2 + 2}" 
                    font-family="sans-serif" font-size="14" font-weight="bold" fill="${textColor}" 
                    text-anchor="middle" dominant-baseline="middle">
                    ${number}
        </text>
    </svg>`;
};

// 🆕 Variabel untuk menyimpan referensi fungsi click handler agar bisa di-remove
let mapClickListener = null;

// 🆕 FUNGSI UNTUK MENGAKTIFKAN KLIK PETA
function enableMapSelection() {
    // Pastikan listener lama sudah dibersihkan sebelum menambahkan yang baru
    if (mapClickListener) {
        map.off("click", mapClickListener);
    }

    // 1. Definisikan Map Click Listener
    mapClickListener = (e) => {
        // 1. Hapus marker lama (jika ada)
        if (mapSelectMarker) {
            mapSelectMarker.remove();
        }

        // 2. Simpan koordinat baru
        selectedCenterPoint = [e.lngLat.lng, e.lngLat.lat];

        // 3. Buat marker baru dengan style kustom (UNGU)
        const el = document.createElement("div");
        const svg = createBaseMarkerSvg(MAP_SELECT_COLOR);
        el.innerHTML = svg;
        el.style.width = "32px";
        el.style.height = "32px";

        mapSelectMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(e.lngLat)
            .addTo(map);

        console.log("Titik Pusat Isokron Baru:", selectedCenterPoint);
    };

    // 2. Pasang Listener
    map.on("click", mapClickListener);
    console.log("Map selection enabled.");
}

// 🆕 FUNGSI UNTUK MENONAKTIFKAN KLIK PETA
function disableMapSelection() {
    if (mapClickListener) {
        map.off("click", mapClickListener);
        mapClickListener = null;
    }
    // Hapus marker ungu saat dinonaktifkan
    if (mapSelectMarker) {
        mapSelectMarker.remove();
        mapSelectMarker = null;
    }
    console.log("Map selection disabled.");
}

// 🆕 FUNGSI BARU: Hapus Layer dan Source Hasil Titik Isokron (PENCEGAH DUPLIKASI)
function removeIsokronResultLayers() {
    const layerId = "hasil-isokron-titik";
    const sourceId = "hasil-isokron-titik";

    // Hapus layer titik hasil isokron jika ada
    if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
        console.log(`Layer ${layerId} dihapus.`);
    }

    // Hapus source data titik hasil isokron jika ada
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
        console.log(`Source ${sourceId} dihapus.`);
    }

    // Reset variabel global dan daftar hasil
    hasilIsokronTitik = null;
    document.getElementById("result").innerHTML = "";
    console.log("Layer titik isokron lama dibersihkan.");
}
// ---

map.on("load", () => {
    const triggerButton = document.getElementById("tomb-run");
    triggerButton.addEventListener("click", () => execute());
    addCustomLayers();
    // 🟥 initializeMapSelection() Dihapus dari sini.

    // 🆕 KODE TAMBAHAN UNTUK INTERAKSI UI PANEL ASIDE (LOGIC TOGGLE BERGANTI) 🆕
    const tombolIsokron = document.querySelector('[title="Isokron"]');
    const asideMap = document.getElementById("asideMap");
    const closeButton = document.querySelector('[data-close-button]');

    if (!tombolIsokron || !asideMap || !closeButton) {
        console.warn("Elemen UI Isokron (tombol, panel, atau tombol tutup) tidak ditemukan. Fungsi toggle UI dibatalkan.");
    } else {
        // 1. Logic Toggle Panel
        tombolIsokron.addEventListener("click", () => {
            const isHidden = asideMap.style.transform.includes("-100%");
            if (isHidden) {
                asideMap.style.transform = "translateX(0)";
                enableMapSelection(); // 🟢 AKTIFKAN KLIK PETA saat panel dibuka
            } else {
                asideMap.style.transform = "translateX(calc(-100% - 2rem))";
                disableMapSelection(); // 🔴 NONAKTIFKAN KLIK PETA saat panel ditutup
                // 🛑 Perubahan 1: Hapus layer titik saat panel ditutup (toggle)
                removeIsokronResultLayers();
            }
        });

        // 🟢 Listener untuk Tombol Tutup Saja.
        closeButton.addEventListener("click", () => {
            asideMap.style.transform = "translateX(calc(-100% - 2rem))";
            disableMapSelection(); // 🔴 NONAKTIFKAN KLIK PETA saat tombol tutup diklik
            // 🛑 Perubahan 1: Hapus layer titik saat panel ditutup (tombol close)
            removeIsokronResultLayers();
        });

        // 2. Logic Responsivitas Tinggi Panel
        const aside = document.getElementById('asideMap');

        function updateInsetY() {
            const width = window.innerWidth;
            if (width >= 1536) {
                aside.style.top = '15rem'; aside.style.bottom = '15rem';
            } else if (width >= 1280) {
                aside.style.top = '12.5rem'; aside.style.bottom = '12.5rem';
            } else if (width >= 1024) {
                aside.style.top = '12rem'; aside.style.bottom = '14rem';
            } else if (width >= 768) {
                aside.style.top = '12rem'; aside.style.bottom = '13rem';
            } else if (width >= 640) {
                aside.style.top = '12rem'; aside.style.bottom = '14rem';
            } else {
                aside.style.top = '12rem'; aside.style.bottom = '12rem';
            }
        }

        window.addEventListener('resize', updateInsetY);
        updateInsetY(); // Initial run
    }
    // 🆕 AKHIR KODE TAMBAHAN UI PANEL ASIDE 🆕
});


// 🔥 Tombol Heatmap
const toggleBtn = document.getElementById("heatmap-toggle");
const heatmapLayers = ["heatmapLayersatu", "heatmapLayerdua", "heatmapLayertiga", "heatmapLayerempat"];
let heatmapVisible = false;

toggleBtn.addEventListener("click", () => {
    heatmapVisible = !heatmapVisible;

    // Nonaktifkan klik peta saat heatmap aktif, terlepas dari status panel.
    disableMapSelection();

    // 🟥 Sembunyikan/tampilkan titik hasil isokron agar eksklusif dengan heatmap
    if (map.getLayer("hasil-isokron-titik")) {
        map.setLayoutProperty("hasil-isokron-titik", "visibility", heatmapVisible ? "none" : "visible");
    }

    if (heatmapVisible) {
        // 🔥 Jika heatmap diaktifkan, hapus layer isokron sepenuhnya
        if (map.getLayer("isokron-fill")) map.removeLayer("isokron-fill");
        if (map.getLayer("isokron-layer")) map.removeLayer("isokron-layer");
        if (map.getSource("isokron")) map.removeSource("isokron");
        isokronVisible = false;
        hasilIsokron = null;
        // hasilIsokronTitik = null; // Dibiarkan agar bisa dimunculkan lagi saat heatmap mati

        document.getElementById("result").innerHTML = "";
    } else {
        // Jika heatmap dimatikan, aktifkan kembali map selection jika panel isokron terbuka
        const asideMap = document.getElementById("asideMap");
        if (asideMap && !asideMap.style.transform.includes("-100%")) {
            enableMapSelection();
        }
    }

    // Tampilkan / sembunyikan heatmap
    heatmapLayers.forEach(id => {
        if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", heatmapVisible ? "visible" : "none");
        }
    });

    toggleBtn.innerHTML = heatmapVisible ? "❄️" : "🔥";
    toggleBtn.title = heatmapVisible ? "Matikan Heatmap" : "Aktifkan Heatmap";
});

// 🧭 Tombol Isokron (matikan heatmap & reset tombol)
document.getElementById("isokron-toggle").addEventListener("click", () => {
    heatmapLayers.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, "visibility", "none"));
    heatmapVisible = false;
    toggleBtn.innerHTML = "🔥";
    toggleBtn.title = "Aktifkan Heatmap";
});

// 🗺️ Ganti Basemap
document.getElementById("basemapSelect").addEventListener("change", e => {
    map.setStyle(`https://basemap.mapid.io/styles/${e.target.value}/style.json?key=${MAP_SERVICE_KEY}`);
    // Logic untuk menambahkan kembali layer sudah ditangani di styledata listener
});

// 🎨 Tambah Layer & Ikon
const layerInfo = [
    { id: "68aef22eb2fcc5561a32adc3", heat: "satu", titik: "pmk", srcSuffix: "" },
    { id: "68f5b49844612b4d22fb43e6", heat: "dua", titik: "tambahan", srcSuffix: "dua" },
    { id: "68f5b4a244612b4d22fb47a4", heat: "tiga", titik: "tambahan-dua", srcSuffix: "tiga" },
    { id: "68f5b4ac44612b4d22fb558b", heat: "empat", titik: "tambahan-tiga", srcSuffix: "empat" }
];
const apiKey = "10b2e2781d0d48629e03d6b6d4eff098";
const project = "68ad26dc329a028a97ae7f94";
const baseUrl = "https://geoserver.mapid.io/layers_new/get_layer";
const categories = {
    "TEMPAT WISATA ALAM": "#facc15",
    "TEMPAT WISATA BUDAYA DAN SEJARAH": "#38bdf8",
    "TEMPAT HIBURAN": "#2dd4bf",
    "BIOSKOP": "#f87171"
};

function addCustomLayers() {
    // 🔸 Tambahkan ikon dinamis (menggunakan createBaseMarkerSvg)
    const addIcon = (name, color) => {
        const id = `icon-${name.toLowerCase().replace(/\s+/g, "-")}`;
        if (map.hasImage(id)) return;
        const svg = createBaseMarkerSvg(color);

        const img = new Image(32, 32);
        img.src = "data:image/svg+xml;base64," + btoa(svg);
        img.onload = () => map.addImage(id, img);
    };
    Object.entries(categories).forEach(([k, c]) => addIcon(k, c));

    // 🆕 Daftarkan ikon pilihan pengguna (ungu) untuk antisipasi load data
    const addSelectIcon = () => {
        if (map.hasImage("icon-select-point")) return;
        const svg = createBaseMarkerSvg(MAP_SELECT_COLOR);
        const img = new Image(32, 32);
        img.src = "data:image/svg+xml;base64," + btoa(svg);
        img.onload = () => map.addImage("icon-select-point", img);
    };
    addSelectIcon();

    // 🟢 Pastikan layer ditambahkan setelah source dimuat
    map.once("idle", () => {
        layerInfo.forEach((info) => {
            const heatId = `heatmapLayer${info.heat}`;
            const titikId = `titik-${info.titik}`;
            const src = `geojsonHeatmap${info.srcSuffix}`;

            if (!map.getSource(src)) {
                map.addSource(src, { type: "geojson", data: `${baseUrl}?api_key=${apiKey}&layer_id=${info.id}&project_id=${project}` });
            }

            // 🔥 Tambah heatmap
            if (!map.getLayer(heatId)) {
                map.addLayer({
                    id: heatId,
                    type: "heatmap",
                    source: src,
                    maxzoom: 15,
                    layout: { visibility: heatmapVisible ? "visible" : "none" },
                    paint: {
                        "heatmap-color": [
                            "interpolate", ["linear"], ["heatmap-density"],
                            0, "rgba(0,0,255,0)", 0.2, "royalblue", 0.4, "cyan", 0.6, "lime", 0.8, "yellow", 1, "red"
                        ],
                        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 20, 13, 30]
                    }
                });
            }

            // 🧭 Tambah simbol titik wisata
            if (!map.getLayer(titikId)) {
                map.addLayer({
                    id: titikId,
                    type: "symbol",
                    source: src,
                    layout: {
                        "icon-image": [
                            "match", ["get", "TIPE_2"],
                            ...Object.keys(categories).flatMap(k => [k, `icon-${k.toLowerCase().replace(/\s+/g, "-")}`]),
                            "icon-tempat-wisata-alam"
                        ],
                        "icon-size": ["interpolate", ["linear"], ["zoom"], 0, 0.2, 5, 0.5, 11, 0.7],
                        "icon-allow-overlap": true
                    }
                });
            }
        });

        // 🔹 Pastikan semua heatmap di atas titik (jika ada)
        layerInfo.forEach(info => {
            const heatId = `heatmapLayer${info.heat}`;
            if (map.getLayer(heatId)) map.moveLayer(heatId);
        });
    });
}


// 🌍 GLOBAL VARIABLE BARU (Simpan data biar gak download terus)
let cachedWisataFeatures = null;

// 🧭 PROSES UTAMA ISOKRON (VERSI DOWNLOAD DATA LANGSUNG)
async function execute() {
    const loading = document.getElementById("loading");
    const triggerButton = document.getElementById("tomb-run");
    const resultDiv = document.getElementById("result");

    // ID Layer output
    const sourceTitikId = "hasil-isokron-titik";
    const sourcePolyId = "isokron";

    // ============================================================
    // 1. BERSIH-BERSIH (Supaya user tau proses sedang jalan)
    // ============================================================
    loading.style.display = "block";
    triggerButton.disabled = true;
    triggerButton.style.opacity = "0.5";
    resultDiv.innerHTML = '<li style="text-align:center;">⏳ Sedang memproses...</li>';

    // Hapus visualisasi lama secepat kilat
    if (map.getSource(sourceTitikId)) {
        map.getSource(sourceTitikId).setData({ type: "FeatureCollection", features: [] });
    }
    if (map.getSource(sourcePolyId)) {
        map.getSource(sourcePolyId).setData({ type: "FeatureCollection", features: [] });
    }

    try {
        // ============================================================
        // 2. AMBIL DATA ISOKRON (POLIGON KUNING)
        // ============================================================
        const durasi = document.getElementById("durasi").value;
        const profile = document.querySelector('input[name="profile"]:checked').value;
        const centerPoint = selectedCenterPoint || [113.482662646211, -7.160562247162545];

        console.log("--- Mulai Proses ---");

        // Fetch Isokron
        const urlIso = `https://routing.mapid.io/isochrone?key=${MAP_SERVICE_KEY}&point=${centerPoint[1]},${centerPoint[0]}&profile=${profile}&time_limit=${durasi}`;
        const resIso = await fetch(urlIso);
        const dataIso = await resIso.json();

        if (!dataIso || !dataIso.polygons || dataIso.polygons.length === 0) throw new Error("Area jangkauan tidak ditemukan.");

        const polygonFeature = dataIso.polygons[0];
        const turfPolygon = turf.polygon(polygonFeature.geometry.coordinates);

        // Tampilkan Area Kuning
        if (map.getSource(sourcePolyId)) {
            map.getSource(sourcePolyId).setData(polygonFeature);
        } else {
            map.addSource(sourcePolyId, { type: "geojson", data: polygonFeature });
            map.addLayer({
                id: "isokron-fill", type: "fill", source: sourcePolyId,
                paint: { "fill-color": "#FACC15", "fill-opacity": 0.25 }
            });
            map.addLayer({
                id: "isokron-layer", type: "line", source: sourcePolyId,
                paint: { "line-color": "#3B82F6", "line-width": 3, "line-opacity": 0.9, "line-dasharray": [2, 2] }
            });
        }

        // Simpan hasil poligon ke global variable untuk redraw saat ganti basemap
        hasilIsokron = polygonFeature;
        isokronVisible = true;

        // Zoom ke area
        const bbox = turf.bbox(polygonFeature);
        map.fitBounds(bbox, { padding: 80, duration: 1000 });

        // ============================================================
        // 3. AMBIL DATA TITIK WISATA (FIXED: MANUAL FETCH)
        // ============================================================

        // Cek apakah kita sudah punya data wisata di memori?
        if (!cachedWisataFeatures) {
            console.log("📥 Mendownload data titik wisata dari server...");
            // Kita download semua layer wisata secara manual
            const fetchPromises = layerInfo.map(async (info) => {
                const urlTitik = `${baseUrl}?api_key=${apiKey}&layer_id=${info.id}&project_id=${project}`;
                try {
                    const res = await fetch(urlTitik);
                    const json = await res.json();
                    return json.features || [];
                } catch (err) {
                    console.error(`Gagal download layer ${info.id}`, err);
                    return [];
                }
            });

            const results = await Promise.all(fetchPromises);
            // Gabungkan semua array hasil download jadi satu
            cachedWisataFeatures = results.flat();
            console.log(`✅ Berhasil download ${cachedWisataFeatures.length} titik total.`);
        } else {
            console.log(`⚡ Menggunakan cache memori (${cachedWisataFeatures.length} titik).`);
        }

        // ============================================================
        // 4. HITUNG MATEMATIKA (TURF)
        // ============================================================
        // Hapus duplikat (jika ada tumpukan data)
        const uniquePoints = [];
        const seenIds = new Set();

        cachedWisataFeatures.forEach(p => {
            // ID Unik berdasarkan koordinat
            const id = JSON.stringify(p.geometry.coordinates);
            if (!seenIds.has(id)) {
                seenIds.add(id);
                uniquePoints.push(p);
            }
        });

        // Filter titik yang MASUK dalam area kuning
        let nomorUrut = 1;
        const finalPoints = uniquePoints.filter(p => {
            if (!p.geometry || p.geometry.type !== 'Point') return false;
            return turf.booleanPointInPolygon(turf.point(p.geometry.coordinates), turfPolygon);
        }).map(p => {
            const newP = JSON.parse(JSON.stringify(p));
            // Bersihkan properti sampah mapbox
            Object.keys(newP.properties).forEach(k => { if (k.startsWith('_')) delete newP.properties[k]; });

            newP.properties.nomor_urut = nomorUrut++;
            newP.properties.icon_id_dinamis = `${ISOCHRONE_HIGHLIGHT_ID}-${newP.properties.nomor_urut}`;
            return newP;
        });

        console.log(`🎯 Hasil Akhir: ${finalPoints.length} titik terpilih.`);

        // ============================================================
        // 5. RENDER MARKER KEREN & LIST
        // ============================================================

        // Generate Ikon Angka (Promise All)
        const iconPromises = finalPoints.map(p => {
            const iconId = p.properties.icon_id_dinamis;
            const num = p.properties.nomor_urut;
            return new Promise(resolve => {
                if (map.hasImage(iconId)) { resolve(); return; }
                const svg = createNumberedMarkerSvg(num);
                const img = new Image(48, 48);
                img.src = "data:image/svg+xml;base64," + btoa(svg);
                img.onload = () => { if (!map.hasImage(iconId)) map.addImage(iconId, img); resolve(); };
                img.onerror = () => resolve();
            });
        });
        await Promise.all(iconPromises);

        // Update List Sidebar
        if (finalPoints.length > 0) {
            resultDiv.innerHTML = finalPoints
                .map(f => `<li><b>${f.properties.nomor_urut}.</b> ${f.properties.NAMA || f.properties.Name || 'Wisata Tanpa Nama'}</li>`)
                .join("");
        } else {
            resultDiv.innerHTML = "<li>Tidak ada tempat wisata dalam jangkauan ini.</li>";
        }

        // Tampilkan Marker di Peta
        const geojsonResult = { type: "FeatureCollection", features: finalPoints };

        // Simpan hasil titik ke global variable untuk redraw saat ganti basemap
        hasilIsokronTitik = geojsonResult;

        if (map.getSource(sourceTitikId)) {
            map.getSource(sourceTitikId).setData(geojsonResult);
        } else {
            map.addSource(sourceTitikId, { type: "geojson", data: geojsonResult });
            map.addLayer({
                id: sourceTitikId,
                type: "symbol",
                source: sourceTitikId,
                layout: {
                    "icon-image": ["get", "icon_id_dinamis"],
                    "icon-size": 1,
                    "icon-allow-overlap": true,
                    "text-allow-overlap": false
                }
            });
        }

        // Rapikan Layer (Marker di atas)
        if (map.getLayer("isokron-layer") && map.getLayer(sourceTitikId)) map.moveLayer(sourceTitikId);
        if (mapSelectMarker) mapSelectMarker.addTo(map);

    } catch (error) {
        console.error("Error:", error);
        resultDiv.innerHTML = `<li style="color:red;">Error: ${error.message}</li>`;
    } finally {
        loading.style.display = "none";
        triggerButton.disabled = false;
        triggerButton.style.opacity = "1";
    }
}

// 🧭 Penanganan Layer Hilang Setelah Ganti Basemap (styledata listener tunggal)
// 🟢 PERBAIKAN BASEMAP: Logika dipindahkan ke sini untuk memastikan redraw setelah style dimuat
map.on("styledata", () => {
    // Dipicu setelah map.setStyle()
    map.once("idle", () => {
        // 1. Tambahkan/Update Layer Wisata & Heatmap 
        addCustomLayers();

        // 2. Tambahkan/Update Layer Isokron (jika sebelumnya sudah pernah dihitung)
        if (isokronVisible && hasilIsokron) {

            // Hapus layer fill dan line lama jika ada
            if (map.getLayer("isokron-fill")) map.removeLayer("isokron-fill");
            if (map.getLayer("isokron-layer")) map.removeLayer("isokron-layer");

            if (map.getSource("isokron")) {
                map.getSource("isokron").setData(hasilIsokron);
            } else {
                map.addSource("isokron", { type: "geojson", data: hasilIsokron });
            }

            // 🟢 Layer Fill
            map.addLayer({
                id: "isokron-fill",
                type: "fill",
                source: "isokron",
                paint: { "fill-color": "#FACC15", "fill-opacity": 0.25 }
            });

            // 🟢 Layer Garis
            map.addLayer({
                id: "isokron-layer",
                type: "line",
                source: "isokron",
                paint: {
                    "line-color": "#3B82F6", "line-width": 3, "line-opacity": 0.9, "line-dasharray": [2, 2]
                }
            });

            // 3. Tambahkan/Update Layer Titik Hasil Isokron
            if (hasilIsokronTitik && hasilIsokronTitik.features.length > 0) {

                // 🆕 Daftarkan ulang semua ikon komposit yang diperlukan (TUNGGU Promise.all)
                const registerIconPromises = hasilIsokronTitik.features.map(f => {
                    const number = f.properties.nomor_urut;
                    const iconId = `${ISOCHRONE_HIGHLIGHT_ID}-${number}`;

                    return new Promise(resolve => {
                        if (map.hasImage(iconId)) {
                            resolve();
                            return;
                        }

                        const svg = createNumberedMarkerSvg(number);
                        const img = new Image(48, 48);
                        img.src = "data:image/svg+xml;base64," + btoa(svg);
                        img.onload = () => {
                            if (!map.hasImage(iconId)) {
                                map.addImage(iconId, img);
                            }
                            f.properties.icon_id_dinamis = iconId;
                            resolve();
                        };
                        img.onerror = () => {
                            console.error(`Gagal memuat ikon saat styledata: ${iconId}`);
                            resolve(); // Tetap lanjutkan meskipun gagal
                        };
                    });
                });

                // Tambahkan layer setelah semua ikon selesai dimuat
                Promise.all(registerIconPromises).then(() => {
                    if (map.getLayer("hasil-isokron-titik")) map.removeLayer("hasil-isokron-titik");

                    if (map.getSource("hasil-isokron-titik")) {
                        map.getSource("hasil-isokron-titik").setData(hasilIsokronTitik);
                    } else {
                        map.addSource("hasil-isokron-titik", { type: "geojson", data: hasilIsokronTitik });
                    }

                    map.addLayer({
                        id: "hasil-isokron-titik",
                        type: "symbol",
                        source: "hasil-isokron-titik",
                        layout: {
                            "icon-image": ["get", "icon_id_dinamis"],
                            "icon-size": 1,
                            "icon-allow-overlap": true,
                            "text-allow-overlap": false
                        },
                    });

                    // Pastikan layer titik isokron di atas layer isokron
                    if (map.getLayer("isokron-layer")) {
                        map.moveLayer("hasil-isokron-titik");
                    }

                    // Sinkronkan visibilitas dengan state heatmap
                    map.setLayoutProperty("hasil-isokron-titik", "visibility", heatmapVisible ? "none" : "visible");
                });
            }

            // Atur kembali visibilitas heatmap
            heatmapLayers.forEach(id => {
                if (map.getLayer(id)) {
                    map.setLayoutProperty(id, "visibility", heatmapVisible ? "visible" : "none");
                }
            });

            // 🟢 Pastikan marker ungu (titik pusat isokron) berada di paling atas
            if (mapSelectMarker) {
                mapSelectMarker.addTo(map);
            }
        }
    });
});









// POP UP MENU SAAT KLIK TITIK
map.on("load", () => {
    addCustomLayers();
});




// TAMPILAN POP UP INTERAKTIF
map.on("click", ['titik-pmk', 'titik-tambahan', 'titik-tambahan-dua', 'titik-tambahan-tiga'], (e) => {
    const feature = e.features[0];
    const coords = feature.geometry.coordinates.slice();
    const props = feature.properties;

    const nama = props.NAMA_TEMPAT || props.NAMA || "Tidak diketahui";
    const tipe = props.TIPE_2 || "Tanpa kategori";
    const desksatu = props.TIPE_3 || "Tanpa kategori";
    const alamat = props.ALAMAT || "Alamat tidak tersedia";

    new maplibregl.Popup()
        .setLngLat(coords)
        .setHTML(`
            <div style="font-family: 'TASA Explorer', sans-serif; line-height: 1.4; color: #333; font-size: 14px; text-align: center;">
                <span style="color: rgb(27,60,83); font-weight: bold; font-size: 18px;">${nama}</span><br>
                <span style="color: black;"><em>${tipe}</em></span><br>
                <span style="color: gray;"><strong> ${desksatu}</strong></span><br>
                <span style="color: gray; font-size: 10px;">${alamat}</span>
            </div>
        `)
        .addTo(map);
});

// UBAH KURSOR SAAT HOVER DI TITIK
map.on("mouseenter", ['titik-pmk', 'titik-tambahan', 'titik-tambahan-dua', 'titik-tambahan-tiga'], () => {
    map.getCanvas().style.cursor = "pointer";
});
map.on("mouseleave", ['titik-pmk', 'titik-tambahan'], 'titik-tambahan-dua', 'titik-tambahan-tiga', () => {
    map.getCanvas().style.cursor = "";
});







// MENGAMBAHKAN LEGENDA
// === LEGEND MAP ===
function addLegend() {
    // hapus legend lama kalau ada
    const oldLegend = document.getElementById("map-legend");
    if (oldLegend) oldLegend.remove();

    // buat elemen legend container
    const legend = document.createElement("div");
    legend.id = "map-legend";
    legend.style.position = "absolute";
    legend.style.bottom = "20px";
    legend.style.color = "black";
    legend.style.left = "20px";
    legend.style.background = "white";
    legend.style.padding = "10px 14px";
    legend.style.borderRadius = "8px";
    legend.style.border = "3px solid rgba(168,162,158,1)";
    legend.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
    legend.style.fontFamily = "TASA Explorer, sans-serif";
    legend.style.fontSize = "13px";
    legend.style.lineHeight = "18px";
    legend.style.zIndex = "1";

    const categories = {
        "TEMPAT WISATA ALAM": "#facc15", // kuning
        "TEMPAT WISATA BUDAYA DAN SEJARAH": "#38bdf8", // biru
        "TEMPAT HIBURAN": "#2dd4bf", // teal
        "BIOSKOP": "#f87171" // merah
    };

    // buat isi legend
    Object.entries(categories).forEach(([label, color]) => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.marginBottom = "6px";

        const icon = document.createElement("div");
        icon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                viewBox="0 0 24 24" fill="${color}" stroke="white"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="feather feather-map-pin">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="5"></circle>
            </svg>`;
        icon.style.marginRight = "8px";

        const text = document.createElement("span");
        text.textContent = label;

        item.appendChild(icon);
        item.appendChild(text);
        legend.appendChild(item);
    });

    // tambahkan ke elemen container peta
    map.getContainer().appendChild(legend);
}

// panggil legend saat map sudah siap
map.on("load", () => {
    addLegend();
});






// TAMBAH NAVIGASI ZOOM IN DAN OUT
const nav = new maplibregl.NavigationControl({
    showCompass: true,
});
map.addControl(nav, "top-left");


// MENAMBAHKAN FITUR GEOLOKASI
const geolocate = new maplibregl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true,
    },
    trackUserLocation: true,
});
map.addControl(geolocate, "top-left");


// // masukkan lokasi user
// map.on("load", () => {
//     geolocate.trigger();
// });



// const geolab = document.getElementById("geolab");
// const tools = document.getElementById("tools");

// geolab.addEventListener("click", () => {
//     geolab.classList.add("fade-out-normal");
//     geolab.addEventListener('animationend', () => {
//       geolab.style.display = 'none';
//       tools.classList.add("slide-in-left");
//       tools.style.opacity = 1;
//       tools.style.left = "5px";
//       tools.style.pointerEvents = "auto";
//     }, { once: true });
// });


const geolab = document.getElementById("geolab");
const tools = document.getElementById("tools");

let isToolsVisible = false;

geolab.addEventListener("click", () => {
    if (isToolsVisible) return;

    isToolsVisible = true;
    geolab.classList.add("dramatic-out");

    geolab.addEventListener("animationend", () => {
        geolab.style.display = "none";
        tools.classList.add("dramatic-in");
        tools.style.opacity = 1;
        tools.style.left = "-15px";
        tools.style.pointerEvents = "auto";
    }, { once: true });
});

document.addEventListener("click", (event) => {
    const isInsideGeolab = geolab.contains(event.target);
    const isInsideTools = tools.contains(event.target);

    if (!isInsideGeolab && !isInsideTools && isToolsVisible) {
        // Hide tools
        tools.classList.remove("dramatic-in");
        tools.style.opacity = 0;
        tools.style.left = "-80px";
        tools.style.pointerEvents = "none";

        // Show geolab with reset animation
        geolab.style.display = "flex";
        geolab.classList.remove("dramatic-out");
        geolab.classList.add("dramatic-reset");

        geolab.addEventListener("animationend", () => {
            geolab.classList.remove("dramatic-reset");
            isToolsVisible = false;
        }, { once: true });
    }
});






