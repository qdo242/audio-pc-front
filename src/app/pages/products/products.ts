import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Product } from '../../interfaces/product';
import { ProductService } from '../../services/product';
import { Observable } from 'rxjs';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProductCard],
  templateUrl: './products.html',
  styleUrl: './products.scss',
})
export class Products implements OnInit {
  
  // SỬA: KHÔI PHỤC TẤT CẢ CÁC THUỘC TÍNH BỊ MẤT
  products: Product[] = []; 
  filteredProducts: Product[] = []; 
  brands: string[] = [];
  headphoneTypes: string[] = [];
  
  searchTerm: string = '';
  selectedCategory: string = 'all';
  selectedBrand: string = 'all';
  selectedConnectivity: string[] = [];
  selectedType: string = 'all';
  showMobileFilters: boolean = false;
  isLoading: boolean = true;

  categories = [
    { value: 'all', label: 'Tất cả sản phẩm' },
    { value: 'headphone', label: 'Tai nghe' },
    { value: 'speaker', label: 'Loa' }
  ];

  connectivityOptions = [
    { value: 'wireless', label: 'Không dây' },
    { value: 'wired', label: 'Có dây' }
  ];
  // KẾT THÚC KHÔI PHỤC

  constructor(
    private productService: ProductService,
    private router: Router 
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
    this.loadFilterOptions();
  }

  // SỬA: Xóa hàm getFullImageUrl (vì product-card đã xử lý)

  loadInitialData(): void {
    this.isLoading = true;
    this.productService.getAllProducts().subscribe({
      next: (products) => {
        // SỬA: Không cần .map nữa, product-card tự xử lý
        this.products = products;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.isLoading = false;
      }
    });
  }
  
  loadFilterOptions(): void {
    this.productService.getBrands().subscribe({
      next: (brands) => this.brands = brands,
      error: (error) => console.error('Error loading brands:', error)
    });

    this.productService.getHeadphoneTypes().subscribe({
      next: (types) => this.headphoneTypes = types,
      error: (error) => console.error('Error loading headphone types:', error)
    });
  }

  onFilterChange(): void { this.applyFilters(); }
  onSearchChange(): void { this.applyFilters(); }
  
  applyFilters(): void {
    this.isLoading = true;
    let filtered = this.products; 

    if (this.searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        p.brand.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === this.selectedCategory);
    }
    if (this.selectedBrand !== 'all') {
      filtered = filtered.filter(p => p.brand === this.selectedBrand);
    }
    // Lọc theo loại tai nghe (nếu có)
    if (this.selectedType !== 'all' && (this.selectedCategory === 'headphone' || this.selectedCategory === 'all')) {
      filtered = filtered.filter(p => p.type === this.selectedType);
    }

    // SỬA LỖI TS2339: Thay .some() bằng .includes()
    // Lọc theo kết nối (nếu có)
    if (this.selectedConnectivity.length > 0) {
      filtered = filtered.filter(p => 
        p.connectivity && this.selectedConnectivity.includes(p.connectivity)
      );
    }
    
    this.filteredProducts = filtered;
    this.isLoading = false;
  }
  
  viewProduct(productId: string): void {
    this.router.navigate(['/products', productId]);
  }
  
  toggleConnectivity(connectivity: string): void {
    const index = this.selectedConnectivity.indexOf(connectivity);
    if (index > -1) {
      this.selectedConnectivity.splice(index, 1);
    } else {
      this.selectedConnectivity.push(connectivity);
    }
    this.onFilterChange();
  }

  toggleMobileFilters(): void {
    this.showMobileFilters = !this.showMobileFilters;
  }

  getCategoryLabel(categoryValue: string): string {
    const category = this.categories.find(c => c.value === categoryValue);
    return category ? category.label : categoryValue;
  }

  getConnectivityLabel(connectivity: string): string {
    const connectivityMap: {[key: string]: string} = {
      'wireless': 'Không dây',
      'wired': 'Có dây'
    };
    return connectivityMap[connectivity] || connectivity;
  }

  removeConnectivityFilter(conn: string): void {
    this.selectedConnectivity = this.selectedConnectivity.filter(c => c !== conn);
    this.onFilterChange();
  }

  hasActiveFilters(): boolean {
    return this.selectedCategory !== 'all' || 
           this.selectedBrand !== 'all' || 
           this.selectedConnectivity.length > 0 || 
           this.selectedType !== 'all' ||
           this.searchTerm !== '';
  }

  clearAllFilters(): void {
    this.selectedCategory = 'all';
    this.selectedBrand = 'all';
    this.selectedConnectivity = [];
    this.selectedType = 'all';
    this.searchTerm = '';
    this.onFilterChange();
  }

  getProductCount(): number {
    return this.filteredProducts.length;
  }

  isConnectivitySelected(connectivity: string): boolean {
    return this.selectedConnectivity.includes(connectivity);
  }
}