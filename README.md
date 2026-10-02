# Trường Đại học Sư phạm Kỹ thuật Nam Định (NUTE)
## Hệ thống trợ lý ghi âm và soạn thảo Biên bản cuộc họp

> Ứng dụng tự động gỡ băng ghi âm cuộc họp/hội nghị tiếng Việt, hỗ trợ đa Trợ lý AI (ChatGPT, Gemini, Claude, DeepSeek) phân tích và soạn thảo biên bản họp chuẩn quy cách văn bản hành chính theo **Nghị định số 30/2020/NĐ-CP**, xuất bản trực tiếp sang tệp **Microsoft Word (.docx)** hoàn toàn miễn phí, không yêu cầu khóa API.

---

## 🌟 Tính Năng Nổi Bật

1. **Đa Trợ Lý AI Thực Tế (Không cần Key API)**:
   - 🟢 **ChatGPT (OpenAI GPT-4o)**: Văn phong hành chính trang trọng, súc tích, mạch lạc và bám sát quy chuẩn văn thư.
   - 🔵 **Google Gemini (2.5 Flash)**: Tối ưu hóa nhận diện giọng nói tiếng Việt đa phương thức và tổng hợp biên bản siêu tốc.
   - 🟣 **Claude (Anthropic Claude 3.5)**: Lập luận logic chặt chẽ, tổng hợp thấu đáo các luồng ý kiến thảo luận và kết luận chỉ đạo.
   - 🔴 **DeepSeek AI (V3 / R1)**: Bóc tách trách nhiệm chi tiết, thiết lập ma trận phân công công việc và rà soát tiến độ tối ưu.
   - Người dùng không cần mua hay cấu hình bất kỳ API key nào; hệ thống tự động xử lý trực tiếp.

2. **Chuẩn Thể thức Văn bản Hành chính (Nghị định 30/2020/NĐ-CP)**:
   - **Định lề trang A4 chuẩn văn thư**: Lề trên 20mm, lề dưới 20mm, lề trái 30mm (đóng gáy), lề phải 15mm.
   - **Phông chữ chuẩn**: Times New Roman, dãn dòng 1.15 lines.
   - **Bố cục 2 cột tiêu đề**: Cơ quan ban hành (Trường ĐH SPKT Nam Định) và Quốc hiệu, Tiêu ngữ.
   - **Nội dung hoàn chỉnh**: Thời gian, địa điểm, thành phần, diễn biến cuộc họp, kết luận của chủ trì.
   - **Bảng phân công nhiệm vụ**: Rõ ràng người/đơn vị thực hiện, sản phẩm đầu ra và thời hạn hoàn thành.
   - **Chữ ký 2 bên**: Thư ký cuộc họp (bên trái) và Hiệu trưởng / Chủ trì (bên phải).

3. **Xuất bản Đa định dạng**:
   - Tải về tệp **Microsoft Word (.docx)** chuẩn mực (mở trực tiếp bằng MS Word, Google Docs, LibreOffice).
   - In ấn trực tiếp trang A4 (Ctrl + P).
   - Sao chép nhanh toàn bộ văn bản vào Clipboard để dán vào e-Office hoặc Email.

4. **Sẵn sàng triển khai trên GitHub**:
   - Cài đặt và khởi chạy siêu tốc chỉ với 3 dòng lệnh.
   - Chạy mượt mà trên môi trường máy cá nhân, GitHub Codespaces, Docker, VPS, Vercel hoặc Render.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Trên GitHub / Local

### Bước 1: Clone kho mã nguồn từ GitHub
```bash
git clone https://github.com/your-username/meeting-assistant.git
cd meeting-assistant
```

### Bước 2: Cài đặt các gói phụ thuộc (Dependencies)
```bash
npm install
```

### Bước 3: Khởi chạy máy chủ phát triển
```bash
npm run dev
```

Mở trình duyệt web và truy cập địa chỉ:
```
http://localhost:3000
```
Ứng dụng sẽ hoạt động ngay lập tức, sẵn sàng phục vụ công tác điều hành của Nhà trường!

---

## 📦 Đóng Gói Ứng Dụng (Production Build)

Khi muốn biên dịch để đưa lên máy chủ sản xuất hoặc hosting tĩnh:

```bash
# Biên dịch mã nguồn tối ưu
npm run build

# Chạy ứng dụng sản xuất
npm start
```

---

## 📜 Căn Cứ Pháp Lý & Thể Thức Áp Dụng
- **Nghị định số 30/2020/NĐ-CP** ngày 05 tháng 03 năm 2020 của Chính phủ về công tác văn thư.
- **Phụ lục I**: Bảng chữ viết hoa trong văn bản hành chính và kỹ thuật trình bày văn bản hành chính.
- Mẫu số 1.3: Biên bản cuộc họp, hội nghị của các cơ quan, tổ chức, đơn vị sự nghiệp công lập.

---

*Hệ thống được phát triển phục vụ công tác văn thư và điều hành của Trường Đại học Sư phạm Kỹ thuật Nam Định (NUTE).*
