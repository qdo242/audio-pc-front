import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product';
import { AuthService } from '../../services/auth';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCard],
  templateUrl: './wishlist.html',
  styleUrls: ['./wishlist.scss']
})
export class Wishlist implements OnInit {
  wishlistProducts: Product[] = [];
  isLoading: boolean = true;
  productIds: string[] = [];

  constructor(
    private authService: AuthService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.loadWishlist();
  }

  loadWishlist(): void {
    this.isLoading = true;
    this.authService.getWishlist().pipe(
      switchMap(response => {
        if (response.success && response.wishlist.length > 0) {
          this.productIds = response.wishlist;
          // Tạo một mảng các Observables
          const productObservables = response.wishlist.map(id => {
            return this.productService.getProductById(id);
          });
          // forkJoin sẽ đợi tất cả các API gọi xong
          return forkJoin(productObservables);
        } else {
          // Trả về mảng rỗng nếu wishlist rỗng
          return of([]);
        }
      })
    ).subscribe({
      next: (products) => {
        this.wishlistProducts = products.filter(p => p !== null) as Product[]; // Lọc bỏ sản phẩm null nếu có
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading wishlist products:', error);
        this.isLoading = false;
      }
    });
  }

  // Hàm này được gọi bởi ProductCard (event)
  onProductRemoved(): void {
    this.loadWishlist(); // Tải lại danh sách
  }
}