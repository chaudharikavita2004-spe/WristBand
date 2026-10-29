import { useApp } from "./store";

const dict = {
  dashboard: ["Dashboard", "डैशबोर्ड"],
  devices: ["Devices", "डिवाइस"],
  pulse: ["Pulse Monitoring", "नाड़ी निगरानी"],
  contacts: ["Emergency Contacts", "आपातकालीन संपर्क"],
  shield: ["Safety Shield", "सुरक्षा कवच"],
  travel: ["Travel Safety", "यात्रा सुरक्षा"],
  analytics: ["Analytics & Reports", "विश्लेषण व रिपोर्ट"],
  vault: ["Evidence Vault", "साक्ष्य तिजोरी"],
  medical: ["Medical Card", "मेडिकल कार्ड"],
  notifications: ["Notifications", "सूचनाएं"],
  settings: ["Profile & Privacy", "प्रोफ़ाइल व गोपनीयता"],
  guardian: ["Guardian Dashboard", "अभिभावक डैशबोर्ड"],
  admin: ["WristBand Admin", "रिस्टबैंड एडमिन"],
  sos: ["SOS", "एसओएस"],
  sendSos: ["Send SOS", "एसओएस भेजें"],
  cancel: ["Cancel", "रद्द करें"],
  sendingIn: ["Sending SOS in", "एसओएस भेजा जा रहा है"],
  safetyDashboard: ["WristBand Safety Dashboard", "रिस्टबैंड सुरक्षा डैशबोर्ड"],
  riskScore: ["Safety risk score", "सुरक्षा जोखिम स्कोर"],
  connected: ["Connected", "जुड़ा हुआ"],
  notConnected: ["Not connected", "जुड़ा नहीं"],
  checkIn: ["I'm safe — check in", "मैं सुरक्षित हूँ"],
  demo: ["DEMO MODE", "डेमो मोड"],
  status: ["Safety status", "सुरक्षा स्थिति"],
  safe: ["Safe", "सुरक्षित"],
  alert: ["Alert", "चेतावनी"],
  recent: ["Recent events", "हाल की घटनाएं"],
  battery: ["Battery", "बैटरी"],
  travelSession: ["Travel session", "यात्रा सत्र"],
} as const;

export type TKey = keyof typeof dict;
export function useT() {
  const lang = useApp((s) => s.lang);
  return (k: TKey) => dict[k][lang === "hi" ? 1 : 0];
}
