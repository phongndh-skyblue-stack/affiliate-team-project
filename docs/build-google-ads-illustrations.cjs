const fs = require('fs');
const path = require('path');
const sharp = require('../client/node_modules/sharp');

// Sơ đồ minh họa nghiệp vụ từ code; không phải ảnh chụp giao diện.
const groups = [
 ['## 2.', [
  ['Mở tab Google Ads', 'Google Ads → Keyword Planner', 'Mở mục Google Ads trên thanh điều hướng.', 'Tải tài khoản Ads, dự án, lịch sử và số dự án tiềm năng từ dữ liệu đã lưu.', 'Hiện form nghiên cứu và lịch sử; chưa có tài khoản thì hướng dẫn ủy quyền.'],
  ['Mở phần Ủy quyền Mail', 'Keyword Planner | Ủy quyền Mail', 'Chọn tab con Ủy quyền Mail.', 'Đọc danh sách email và tài khoản gắn với người đang đăng nhập.', 'Hiện email, trạng thái ủy quyền và số tài khoản đã lưu.']
 ]],
 ['### 3.1.', [
  ['Thêm Gmail', 'demo@example.com  →  Thêm mail', 'Nhập địa chỉ email rồi bấm Thêm mail.', 'Kiểm tra định dạng và email trùng trong danh sách của bạn; lưu email hợp lệ.', 'Xuất hiện email ở trạng thái Chưa ủy quyền. Chưa gửi thư ở bước này.']
 ]],
 ['### 3.2.', [
  ['Gửi link ủy quyền', 'Chưa ủy quyền  →  Gửi auth', 'Bấm Gửi auth ở email muốn kết nối.', 'Tạo link Google có thời hạn, lưu thông tin đối chiếu và gửi email chứa link.', 'Hiện thông báo gửi thành công hoặc lỗi gửi email.']
 ]],
 ['### 3.3.', [
  ['Mở link và xác nhận Google', 'Email mời  →  Link xác nhận', 'Mở link trong email, đăng nhập đúng Gmail được mời và đồng ý quyền truy cập.', 'Kiểm tra yêu cầu còn hạn, đổi mã xác nhận và đối chiếu email; lưu ủy quyền.', 'Trang xác nhận thông báo kết quả. Sai email hoặc link hết hạn sẽ bị từ chối.'],
  ['Nhận danh sách tài khoản Ads', 'Đã ủy quyền  →  Tài khoản Ads', 'Xem kết quả sau khi xác nhận Google.', 'Quét tài khoản Ads và tài khoản con; tự lưu tài khoản mới rồi gửi thông báo trong ứng dụng.', 'Các tài khoản đã lưu có thể chọn ở Keyword Planner. Quét lỗi có thể trả danh sách rỗng.']
 ]],
 ['### 3.4.', [
  ['Xem tài khoản của một Gmail', 'Đã ủy quyền  →  Mở rộng', 'Bấm mũi tên mở rộng thẻ email.', 'Giao diện mở phần tài khoản từ dữ liệu đã tải; không quét Google mới.', 'Thấy tên, ID, trạng thái, tiền tệ và dữ liệu ngân sách nếu có.'],
  ['Làm mới danh sách mail', 'Danh sách mail  →  Làm mới', 'Bấm Làm mới ở đầu danh sách.', 'Tải lại email và tài khoản từ cơ sở dữ liệu ứng dụng.', 'Danh sách phản ánh dữ liệu đã lưu mới nhất; không tự quét lại Google.'],
  ['Gửi auth lại', 'Mở rộng email  →  Gửi auth lại', 'Bấm Gửi auth lại trên email đã ủy quyền.', 'Backend kiểm tra và từ chối vì email đã được ủy quyền.', 'Hiện lỗi gửi email. Đây là điểm chưa khớp giữa giao diện và backend.'],
  ['Xóa mail', 'Thẻ email  →  Xóa mail', 'Bấm biểu tượng xóa ở thẻ email.', 'Xóa email, thông tin ủy quyền và tài khoản Ads gắn với email trong ứng dụng.', 'Email biến mất khỏi danh sách. Không có hộp xác nhận trong giao diện hiện tại.']
 ]],
 ['### 4.1.', [
  ['Chọn tài khoản Google Ads', 'Tài khoản Google Ads  ▾', 'Chọn một tài khoản trong danh sách.', 'Trình duyệt giữ ID tài khoản đã chọn; chỉ kiểm tra quyền khi bạn gửi nghiên cứu.', 'Lần khám phá tiếp theo dùng thông tin ủy quyền gắn với tài khoản này.'],
  ['Gắn dự án hiện có', 'Gắn dự án hiện có  ▾', 'Chọn dự án muốn gắn với lần nghiên cứu.', 'Giao diện lấy URL affiliate của dự án đã tải và điền vào form.', 'URL được điền sẵn. Khi quét, backend kiểm tra quyền và lưu liên kết tới dự án.'],
  ['Nhập keyword gốc', 'Từ khóa  →  best vpn, vpn review', 'Chọn Từ khóa; nhập mỗi keyword trên một dòng hoặc ngăn bằng dấu phẩy.', 'Khi gửi, giao diện tách keyword, cắt khoảng trắng và bỏ phần trống.', 'Google nhận keyword gốc; URL bổ sung nếu có sẽ được kết hợp để gợi ý.'],
  ['Nghiên cứu bằng website', 'Website  →  example.com', 'Chọn Website và nhập URL trang muốn nghiên cứu.', 'Giao diện thêm https:// nếu thiếu; khi gửi, backend dùng nguồn URL hoặc tên miền.', 'Google gợi ý keyword theo website hoặc trang đã chọn.'],
  ['Chọn phạm vi website', '☑ Phân tích toàn bộ website', 'Bật để nghiên cứu toàn site; bỏ chọn để dùng một trang.', 'Khi quét, backend gửi tên miền nếu bật; gửi URL trang cụ thể nếu tắt.', 'Phạm vi gợi ý keyword thay đổi theo lựa chọn của bạn.'],
  ['Chọn ngôn ngữ', 'Ngôn ngữ  →  English ▾', 'Chọn ngôn ngữ muốn nghiên cứu.', 'Giao diện lưu lựa chọn; khi quét, backend gửi mã ngôn ngữ cho Google.', 'Kết quả được yêu cầu theo ngôn ngữ đã chọn. Mặc định là English.'],
  ['Chọn thị trường', 'Thị trường  →  Hoa Kỳ ▾', 'Chọn một thị trường hoặc Tất cả thị trường.', 'Khi quét, backend gửi mã địa lý; chọn tất cả thì không giới hạn địa lý trong yêu cầu.', 'Số liệu được yêu cầu theo phạm vi thị trường bạn chọn.'],
  ['Đặt giới hạn kết quả', '50 ━━━━━●━━━━━ 2.000', 'Kéo thanh Giới hạn kết quả; mặc định là 500.', 'Khi đọc kết quả Google, backend dừng ở số tối đa đã yêu cầu.', 'Nhận tối đa số keyword đã chọn; Google có thể trả ít hơn.']
 ]],
 ['### 4.2.', [
  ['Bắt đầu khám phá keyword', 'Khám phá keyword  →  Đang lấy dữ liệu…', 'Bấm Khám phá keyword sau khi điền form.', 'Kiểm tra quyền → tạo nghiên cứu → gọi Google → lưu số liệu → tính điểm và trả kết quả.', 'Hiện bảng keyword và thông báo số kết quả; lỗi sẽ được báo trên màn hình.']
 ]],
 ['### 5.1.', [
  ['Đọc số liệu kết quả', 'Keyword • Volume • CPC • Điểm', 'Xem các ô tổng quan và từng dòng keyword.', 'Google cung cấp số liệu; backend bổ sung phân loại và điểm; giao diện tính tổng quan.', 'Đọc được nhu cầu, cạnh tranh, giá thầu và cơ hội trong lần nghiên cứu.']
 ]],
 ['### 5.3.', [
  ['Xem giải thích điểm cơ hội', 'Điểm cơ hội  →  Mũi tên cuối dòng', 'Bấm mũi tên cuối dòng keyword.', 'Giao diện mở phần giải thích điểm đã có trong kết quả; không gọi Google thêm.', 'Thấy điểm thành phần: nhu cầu /45, cạnh tranh /25, giá thầu /20, xu hướng /10.']
 ]],
 ['### 5.4.', [
  ['Lọc keyword', 'Tìm chữ • Mục đích • Volume • CPC', 'Nhập chữ hoặc chọn điều kiện cơ hội, mục đích, volume và CPC.', 'Trình duyệt lọc dữ liệu đã tải. CPC tối đa được so với mức giá thầu cao.', 'Bảng chỉ hiện keyword phù hợp; ô tổng quan vẫn tính trên toàn bộ kết quả.'],
  ['Sắp xếp keyword', 'Sắp xếp  →  Điểm cơ hội cao nhất ▾', 'Chọn cách sắp xếp trong danh sách.', 'Trình duyệt sắp thứ tự theo điểm, volume, cạnh tranh, CPC, xu hướng hoặc A–Z.', 'Thứ tự dòng đổi ngay; không gọi backend hoặc Google.'],
  ['Chọn từng keyword', '☑ best vpn     ☐ vpn review', 'Đánh dấu các keyword muốn lưu.', 'Trình duyệt giữ danh sách ID đã chọn; chưa ghi dữ liệu vào backend.', 'Thanh hành động hiện số keyword đã chọn và nút Lưu dự án.'],
  ['Chọn tất cả kết quả đang lọc', '☑ Chọn tất cả kết quả đang lọc', 'Bấm checkbox ở đầu bảng.', 'Thêm hoặc bỏ chọn tất cả dòng đang hiển thị theo bộ lọc hiện tại.', 'Các dòng đang lọc được chọn; lựa chọn đã bị ẩn bởi bộ lọc vẫn được giữ.'],
  ['Xóa bộ lọc', 'Bộ lọc đang bật  →  Xóa bộ lọc', 'Bấm Xóa bộ lọc.', 'Giao diện đưa điều kiện lọc về mặc định; không xóa dữ liệu nghiên cứu.', 'Toàn bộ keyword của lần nghiên cứu hiện lại theo cách sắp xếp đang chọn.'],
  ['Bỏ lựa chọn keyword', 'Đã chọn keyword  →  Bỏ chọn', 'Bấm Bỏ chọn trên thanh hành động.', 'Trình duyệt xóa danh sách ID đang chọn.', 'Các checkbox trở về chưa chọn; kết quả nghiên cứu vẫn còn.']
 ]],
 ['## 6.', [
  ['Mở lại nghiên cứu trong lịch sử', 'Lịch sử  →  Sẵn sàng', 'Bấm một lần nghiên cứu đã hoàn tất.', 'Backend kiểm tra quyền, đọc số liệu đã lưu và tính lại phân loại/điểm theo quy tắc hiện tại.', 'Bảng hiển thị kết quả cũ; bỏ lựa chọn trước đó. Không quét Google mới.']
 ]],
 ['## 7.', [
  ['Mở form lưu dự án tiềm năng', 'Đã chọn keyword  →  Lưu dự án', 'Chọn keyword rồi bấm Lưu dự án.', 'Giao diện mở form nhập thông tin; chưa tạo dự án trong cơ sở dữ liệu.', 'Nhập tên, trạng thái, tag, mô tả, ghi chú và website tùy chọn.'],
  ['Xác nhận lưu dự án tiềm năng', 'Tên dự án *  →  Lưu dự án', 'Nhập tên và thông tin nghiên cứu rồi bấm lưu.', 'Backend tạo dự án tiềm năng và bản sao 1–500 keyword, kèm số liệu và nguồn nghiên cứu.', 'Chuyển sang Dự án tiềm năng. Website có thể bổ sung sau.']
 ]],
 ['### 8.1.', [
  ['Tìm dự án tiềm năng', 'Dự án tiềm năng  →  Tìm / Trạng thái', 'Mở Dự án tiềm năng; tìm theo tên, mô tả, tag hoặc trạng thái.', 'Màn tải tối đa 100 dự án; trình duyệt lọc trên danh sách đã tải.', 'Hiện thẻ dự án phù hợp, số keyword, tổng volume và điểm cao nhất.'],
  ['Mở nghiên cứu tiềm năng', 'Thẻ dự án  →  Mở nghiên cứu', 'Bấm Mở nghiên cứu trên thẻ.', 'Giao diện mở bảng chi tiết từ dữ liệu đã tải.', 'Xem thông tin dự án và danh sách keyword ở bảng bên phải.']
 ]],
 ['### 8.2.', [
  ['Sửa thông tin dự án', 'Tên • Trạng thái • Website • Ghi chú', 'Chỉnh thông tin trong bảng chi tiết.', 'Giao diện giữ bản sửa tạm thời; chưa gửi backend.', 'Cần bấm Lưu thay đổi để thông tin được lưu lại.'],
  ['Sửa mục đích tìm kiếm', 'Mục đích keyword  →  Thương mại ▾', 'Chọn mục đích thủ công cho keyword đã lưu.', 'Giao diện giữ lựa chọn. Khi lưu, backend ưu tiên mục đích thủ công hơn kết quả suy ra.', 'Mục đích có thể thay đổi; điểm cơ hội không được tính lại bởi thao tác này.'],
  ['Bỏ keyword khỏi dự án tiềm năng', 'Keyword đã lưu  →  Bỏ keyword', 'Bấm dấu X ở keyword không muốn giữ.', 'Dòng được loại khỏi bản sửa tạm; chỉ cập nhật backend khi lưu thay đổi.', 'Danh sách ngắn lại. Phải còn ít nhất một keyword để lưu.'],
  ['Lưu thay đổi', 'Thông tin đã sửa  →  Lưu thay đổi', 'Bấm Lưu thay đổi sau khi chỉnh xong.', 'Backend kiểm tra quyền, cập nhật thông tin và thay thế danh sách keyword của bản tiềm năng.', 'Hiện thông báo đã cập nhật; dữ liệu Google gốc không bị sửa.']
 ]],
 ['### 8.3.', [
  ['Chuyển thành dự án chính thức', 'Website / affiliate URL  →  Chuyển', 'Nhập URL rồi bấm Chuyển thành dự án; lưu các chỉnh sửa khác trước nếu cần.', 'Backend chuẩn hóa URL, tìm hoặc tạo dự án affiliate rồi liên kết với bản tiềm năng.', 'Trạng thái thành Đã thành dự án. Không tạo chiến dịch quảng cáo.'],
  ['Mở danh sách Projects', 'Đã thành dự án  →  Mở Projects', 'Bấm Mở Projects sau khi chuyển.', 'Giao diện điều hướng tới /dashboard?tab=projects.', 'Mở danh sách dự án để tiếp tục công việc.']
 ]],
 ['### 8.4.', [
  ['Xóa dự án tiềm năng', 'Xóa  →  Xác nhận Xóa snapshot', 'Bấm xóa và xác nhận Xóa snapshot trong hộp thoại.', 'Backend xóa bản tiềm năng và các keyword sao chép của bản này.', 'Danh sách được tải lại; nghiên cứu gốc và dự án chính thức được giữ.']
 ]]
];

const out = path.join(__dirname, 'assets', 'google-ads-user-flow');
fs.mkdirSync(out, {recursive:true});
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function lines(s, limit) {
 const words=s.split(/\s+/), result=[]; let line='';
 for (const w of words) { if ((line+' '+w).trim().length > limit && line) {result.push(line);line=w;} else line=(line+' '+w).trim(); }
 if(line)result.push(line); return result;
}
function txt(s,x,y,size=21,limit=31,color='#334155',weight=400) {
 return `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${lines(s,limit).map((l,i)=>`<tspan x="${x}" dy="${i?30:0}">${esc(l)}</tspan>`).join('')}</text>`;
}
function svg(row,n) {
 const [title,control,action,process,result]=row;
 const cards=[{x:36,label:'BẠN THAO TÁC',body:action,color:'#047857',bg:'#ecfdf5'}, {x:436,label:'HỆ THỐNG XỬ LÝ',body:process,color:'#0369a1',bg:'#eff6ff'}, {x:836,label:'BẠN NHẬN ĐƯỢC',body:result,color:'#6d28d9',bg:'#f5f3ff'}];
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="590" viewBox="0 0 1240 590">
 <rect width="1240" height="590" fill="#f1f5f9"/><rect width="1240" height="132" fill="#0f172a"/>
 ${txt('GOOGLE ADS  /  HƯỚNG DẪN THAO TÁC',36,36,15,100,'#6ee7b7',700)}
 ${txt(String(n).padStart(2,'0')+'  '+title,36,88,30,70,'#ffffff',700)}
 ${cards.map((c,i)=>`<rect x="${c.x}" y="160" width="368" height="335" rx="18" fill="#ffffff" stroke="#dbe3ec"/>
 <rect x="${c.x+20}" y="182" width="328" height="40" rx="10" fill="${c.bg}"/>
 ${txt(c.label,c.x+35,208,16,40,c.color,700)}
 ${txt(c.body,c.x+24,258,21,30)}
 ${i<2?`<circle cx="${c.x+384}" cy="325" r="15" fill="#0f172a"/><path d="M ${c.x+377} 325 h 12 m -5 -5 l 5 5 -5 5" stroke="white" stroke-width="2" fill="none"/>`:''}`).join('')}
 <rect x="36" y="510" width="1168" height="44" rx="10" fill="#e2e8f0"/>
 ${txt(control,54,539,19,105,'#0f172a',700)}
 ${txt('MINH HỌA THEO CODE • Không phải ảnh chụp màn hình • Dữ liệu ví dụ, nếu có',36,578,14,120,'#64748b')}
 </svg>`;
}

(async()=>{
 let n=0; const manifest=[];
 for(const [heading,rows] of groups) for(const row of rows) {
  n++; const name=String(n).padStart(2,'0')+'.png';
  await sharp(Buffer.from(svg(row,n))).png().toFile(path.join(out,name));
  manifest.push({heading,title:row[0],name});
 }
 const docPath=path.join(__dirname,'google-ads-user-flow.md');
 let doc=fs.readFileSync(docPath,'utf8');
 doc=doc.replace(/\n<!-- illustration:start -->[\s\S]*?<!-- illustration:end -->\n/g,'\n');
 doc=doc.replace(/\n> \*\*Ảnh minh họa:[^\n]*\n/g,'\n');
 const blocks=doc.split(/(?=^#{2,3} )/m);
 for(let i=0;i<blocks.length;i++) {
  const head=blocks[i].split('\n')[0];
  const items=manifest.filter(m=>head.startsWith(m.heading+' '));
  if(items.length) blocks[i]=blocks[i].trimEnd()+'\n\n<!-- illustration:start -->\n'+items.map(m=>`**Minh họa: ${m.title}**\n\n![${m.title} — thao tác, xử lý và kết quả](assets/google-ads-user-flow/${m.name})`).join('\n\n')+'\n<!-- illustration:end -->\n\n';
 }
 doc=blocks.join('');
 doc=doc.replace('Ngày đối chiếu code: 15/09/2026.','Ngày đối chiếu code: 15/09/2026.\n\n> **Ảnh minh họa:** '+n+' ảnh sơ đồ theo code, mỗi ảnh cho một thao tác hoặc bước nhận kết quả; không phải ảnh chụp giao diện thật. Các ảnh nằm trong `assets/google-ads-user-flow/` bên cạnh tài liệu.');
 fs.writeFileSync(docPath,doc,'utf8');
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2),'utf8');
 const thumbs=await Promise.all(manifest.map(async m=>({input:await sharp(path.join(out,m.name)).resize(310,148).toBuffer(),left:((Number(m.name.slice(0,2))-1)%4)*310,top:Math.floor((Number(m.name.slice(0,2))-1)/4)*148})));
 await sharp({create:{width:1240,height:Math.ceil(n/4)*148,channels:3,background:'#ffffff'}}).composite(thumbs).png().toFile(path.join(out,'contact-sheet.png'));
 console.log(JSON.stringify({images:n,document:docPath,assets:out}));
})().catch(err=>{console.error(err);process.exit(1)});
