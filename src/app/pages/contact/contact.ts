import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { ContactService, ContactFormData } from '../../services/contact';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule], 
  templateUrl: './contact.html',
  styleUrls: ['./contact.scss']
})
export class Contact {
  contactData: ContactFormData = {
    name: '',
    email: '',
    subject: '',
    message: ''
  };
  
 
  isLoading = false;
  isSubmitted = false;
  errorMessage = '';
 
  constructor(private contactService: ContactService) {}

 
  submitForm(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.isSubmitted = false;

    // Validate (có thể bỏ qua nếu HTML 'required' đã đủ)
    if (!this.contactData.name || !this.contactData.email || !this.contactData.message) {
      this.errorMessage = 'Vui lòng điền đầy đủ các trường bắt buộc (*).';
      this.isLoading = false;
      return;
    }

    this.contactService.send(this.contactData).subscribe({
      next: (response) => {
        if (response.success) {
          this.isSubmitted = true; // Hiển thị thông báo thành công
        } else {
          this.errorMessage = response.message || 'Gửi thất bại. Vui lòng thử lại.';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Contact form error:', err);
        this.errorMessage = 'Đã có lỗi máy chủ xảy ra. Vui lòng thử lại sau.';
        this.isLoading = false;
      }
    });
  }
}