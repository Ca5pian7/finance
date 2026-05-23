export const SECTORS = [
  "AI",
  "Robotics",
  "Semiconductor",
  "Energy",
  "EV",
  "Social Media",
  "Cloud Computing",
  "Defense",
  "Pharma",
  "Fashion",
  "Banking",
  "Space",
  "Crypto",
  "Agriculture",
  "Logistics",
  "Gaming"
];

export const COUNTRIES = ["USA", "China", "India", "Germany", "Brazil", "Japan", "UAE", "Taiwan"];

export const COMMODITIES = {
  OIL: { basePrice: 80 },
  SILICON: { basePrice: 130 },
  FOOD: { basePrice: 100 },
  COPPER: { basePrice: 90 }
};

export const DEFAULT_MACRO = {
  gdpGrowth: 0.026,
  inflation: 0.024,
  unemployment: 0.051,
  rate: 0.03
};

export const COUNTRY_PROFILES = {
  USA: { strength: ["AI", "Banking", "Cloud Computing"], taxRate: 0.23, subsidy: 0.03 },
  China: { strength: ["Manufacturing", "EV", "Logistics"], taxRate: 0.22, subsidy: 0.04 },
  India: { strength: ["Services", "AI", "Cloud Computing"], taxRate: 0.2, subsidy: 0.035 },
  Germany: { strength: ["Defense", "Energy", "EV"], taxRate: 0.25, subsidy: 0.03 },
  Brazil: { strength: ["Agriculture", "Energy"], taxRate: 0.21, subsidy: 0.025 },
  Japan: { strength: ["Robotics", "Semiconductor"], taxRate: 0.24, subsidy: 0.03 },
  UAE: { strength: ["Energy", "Banking"], taxRate: 0.15, subsidy: 0.04 },
  Taiwan: { strength: ["Semiconductor", "AI"], taxRate: 0.2, subsidy: 0.04 }
};

export const SUPPLY_REGIONS = {
  TAIWAN_CHIPS: { resource: "SILICON", sensitivity: 0.8 },
  MIDDLE_EAST_OIL: { resource: "OIL", sensitivity: 0.9 },
  CHINA_MANUFACTURING: { resource: "COPPER", sensitivity: 0.6 },
  INDIA_SERVICES: { resource: "FOOD", sensitivity: 0.4 },
  AFRICA_RAW_MATERIALS: { resource: "COPPER", sensitivity: 0.7 },
  USA_FINANCE_AI: { resource: "SILICON", sensitivity: 0.5 }
};
