export interface Product {
  id: string; // SỬA: MongoDB ID là string
  name: string;
  price: number;
  originalPrice?: number;
  image: string; 
  images?: string[];
  category: string;
  subCategory: string;
  brand: string;
  description: string;
  features: string[];
  stock: number; // SỬA: từ inStock: boolean
  rating: number;
  reviewCount: number; // SỬA: từ reviews: number
  isActive?: boolean;
  isFeatured?: boolean;
  type?: string;
  
  // Thuộc tính chi tiết
  colors?: string[];
  weight?: string;
  batteryLife?: string;
  connectivity?: string[];
  warranty?: string;
  material?: string;
  dimensions?: string;
  impedance?: string;
  frequencyResponse?: string;
  driverSize?: string;
  noiseCancellation?: boolean;
  waterResistant?: boolean;
  chargingTime?: string;
  compatibility?: string[];
  includedItems?: string[];
}


export interface Order {
  id: number;
  items: any[]; 
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
  customer: any;
}