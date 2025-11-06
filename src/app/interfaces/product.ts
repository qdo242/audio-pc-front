export interface Review {
  author: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string; 
  images?: string[];
  category: string;
  //subCategory: string;
  brand: string;
  description: string;
  features: string[];
  stock: number; 
  rating: number;
  reviewCount: number;
  reviews: Review[];
  isActive?: boolean;
  isFeatured?: boolean;
  type?: string;
  
  // Thuộc tính chi tiết
  colors?: string[];
  weight?: string;
  batteryLife?: string;
  connectivity?: string;
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