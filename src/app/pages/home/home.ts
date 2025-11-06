import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProductsGrid } from '../../components/products-grid/products-grid';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product';
// SỬA: Xóa import 'ProductCard' không cần thiết (NG8113)

@Component({
  selector: 'app-home',
  standalone: true,
  // SỬA: Xóa 'ProductCard' khỏi imports
  imports: [CommonModule, RouterModule, ProductsGrid], 
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  heroProducts: Product[] = []; 
  allProducts: Product[] = []; 
  filteredProducts: Product[] = [];
  activeCategory: string = 'all';

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadHeroProducts();
    this.loadAllProductsForTabs();
  }

  // SỬA: THÊM HÀM HELPER NÀY (Fix ảnh vỡ ở Hero)
  getFullImageUrl(url: string | undefined): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    if (!url || url.trim() === '') {
      return ''; // Sẽ được hàm fallback xử lý
    }
    if (url.startsWith('http')) {
      return url;
    }
    return `http://localhost:8080${url}`; 
  }

  // SỬA: Logic thông minh để chọn ảnh (Ưu tiên ảnh bìa)
  getSafeDisplayImage(product: Product): string {
    const defaultPlaceholder = 'assets/images/default-product.png';
    let imageUrl = this.getFullImageUrl(product.image);
    
    if (!imageUrl || imageUrl.endsWith('default-product.png')) { 
      if (product.images && product.images.length > 0) {
        const firstGalleryImage = this.getFullImageUrl(product.images[0]);
        if (firstGalleryImage && !firstGalleryImage.endsWith('default-product.png')) {
          imageUrl = firstGalleryImage;
        }
      }
    }
    return imageUrl || defaultPlaceholder;
  }

  loadHeroProducts(): void {
    this.productService.getNewestProducts(2).subscribe(products => {
      // SỬA: Dùng map để sửa URL ảnh hero
      this.heroProducts = products.map(p => ({
        ...p,
        image: this.getSafeDisplayImage(p) // Dùng logic thông minh
      }));
    });
  }

  loadAllProductsForTabs(): void {
    this.productService.getAllProducts().subscribe(products => {
      // SỬA: Không cần .map nữa (product-card đã tự xử lý)
      this.allProducts = products;
      this.selectCategory(this.activeCategory); 
    });
  }

  selectCategory(category: string): void {
    this.activeCategory = category;
    if (category === 'all') {
      this.filteredProducts = this.allProducts;
    } else {
      this.filteredProducts = this.allProducts.filter(p => p.category === category);
    }
  }
}