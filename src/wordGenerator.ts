import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  ShadingType,
} from 'docx';
import { AdministrativeMinutes } from './types';
import { isReviewed } from './lib/minutesReview';

/**
 * Sinh file Word (.docx) chuẩn theo thể thức Nghị định 30/2020/NĐ-CP của Chính phủ
 * Dành riêng cho Trường Đại học Sư phạm Kỹ thuật Nam Định (NUTE)
 */
export async function generateWordDocument(minutes: AdministrativeMinutes): Promise<Blob> {
  if (!isReviewed(minutes)) throw new Error('Thư ký cần hoàn thiện và xác nhận biên bản trước khi xuất Word.');
  const { opening_statement, discussions, conclusions, tasks, closing_statement } = minutes;
  const metadata = { ...minutes.metadata, superior_agency: 'BỘ GIÁO DỤC VÀ ĐÀO TẠO', agency_name: 'TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH' };

  // Lề trang chuẩn NĐ 30/2020: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm
  const topMargin = convertMillimetersToTwip(20);
  const bottomMargin = convertMillimetersToTwip(20);
  const leftMargin = convertMillimetersToTwip(30);
  const rightMargin = convertMillimetersToTwip(15);

  const chairFull = metadata.chair_name
    ? `${metadata.chair_name} - ${metadata.chair_title || 'Hiệu trưởng'} (${metadata.chair_unit || 'Ban Giám hiệu'})`
    : metadata.chair || 'Chưa khai báo chủ trì';

  const secretaryFull = metadata.secretary_name
    ? `${metadata.secretary_name} - ${metadata.secretary_title || 'Phó Chánh Văn phòng'} (${metadata.secretary_unit || 'Văn phòng Trường'})`
    : metadata.secretary || 'Chưa khai báo thư ký';

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 26, // 13pt (size tính theo half-points: 13 * 2 = 26)
            color: '000000',
          },
          paragraph: {
            spacing: {
              line: 276, // 1.15 line spacing
              before: 60,
              after: 60,
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: topMargin,
              bottom: bottomMargin,
              left: leftMargin,
              right: rightMargin,
            },
          },
        },
        children: [
          // 1. HEADER TABLE: Bảng 2 cột (Cơ quan ban hành bên trái - Quốc hiệu Tiêu ngữ bên phải)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  // Cột trái: Cơ quan chủ quản & Trường ĐH SPKT Nam Định
                  new TableCell({
                    width: { size: 48, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: (metadata.superior_agency || 'BỘ LAO ĐỘNG - THƯƠNG BINH VÀ XÃ HỘI').toUpperCase(),
                            size: 24, // 12pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: (metadata.agency_name || 'TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT NAM ĐỊNH').toUpperCase(),
                            bold: true,
                            size: 24, // 12pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 60 },
                        children: [
                          new TextRun({
                            text: '──────────',
                            size: 20,
                            color: '333333',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: metadata.document_code || 'Số: .../BB-ĐHSPKTNĐ',
                            size: 26, // 13pt
                          }),
                        ],
                      }),
                    ],
                  }),
                  // Cột phải: Quốc hiệu, Tiêu ngữ, Địa danh ngày tháng
                  new TableCell({
                    width: { size: 52, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                            bold: true,
                            size: 24, // 12pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: 'Độc lập - Tự do - Hạnh phúc',
                            bold: true,
                            size: 26, // 13pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 60 },
                        children: [
                          new TextRun({
                            text: '───────────────',
                            size: 20,
                            color: '333333',
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: metadata.location_date || 'Chưa khai báo ngày họp',
                            italics: true,
                            size: 26, // 13pt
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Khoảng cách
          new Paragraph({ spacing: { before: 180, after: 120 }, children: [] }),

          // 2. TÊN LOẠI VĂN BẢN VÀ TRÍCH YẾU
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: 'BIÊN BẢN',
                bold: true,
                size: 30, // 15pt
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 240 },
            children: [
              new TextRun({
                text: (metadata.meeting_title || 'Chưa khai báo tên cuộc họp').toUpperCase(),
                bold: true,
                size: 28, // 14pt
              }),
            ],
          }),

          // 3. I. THỜI GIAN, ĐỊA ĐIỂM
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: 'I. THỜI GIAN, ĐỊA ĐIỂM',
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '- Thời gian: ', bold: true }),
              new TextRun({
                text: `Bắt đầu từ ${metadata.start_time || 'Chưa khai báo'}, kết thúc hồi ${metadata.end_time || 'Chưa khai báo'}.`,
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '- Địa điểm: ', bold: true }),
              new TextRun({
                text: metadata.location || 'Chưa khai báo địa điểm',
              }),
            ],
          }),

          // 4. II. THÀNH PHẦN THAM DỰ
          new Paragraph({
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text: 'II. THÀNH PHẦN THAM DỰ',
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '1. Chủ trì cuộc họp: ', bold: true }),
              new TextRun({ text: chairFull }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '2. Thư ký cuộc họp: ', bold: true }),
              new TextRun({ text: secretaryFull }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '3. Số lượng đại biểu: ', bold: true }),
              new TextRun({
                text: `Tổng số triệu tập: ${metadata.total_invited ?? 0} đồng chí; Có mặt: ${metadata.total_present ?? 0} đồng chí; Vắng mặt: ${metadata.total_absent ?? 0} đồng chí.`,
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '4. Danh sách đại biểu dự: ', bold: true }),
              new TextRun({
                text:
                  metadata.attendees_summary ||
                  metadata.attendees ||
                  '(Theo danh sách triệu tập và điểm danh cuộc họp).',
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '5. Đại biểu vắng mặt: ', bold: true }),
              new TextRun({
                text: metadata.absentees_detail || metadata.absentees || 'Chưa khai báo thông tin vắng mặt.',
              }),
            ],
          }),

          // 5. III. NỘI DUNG VÀ DIỄN BIẾN CUỘC HỌP
          new Paragraph({
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text: 'III. NỘI DUNG VÀ DIỄN BIẾN CUỘC HỌP',
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({ text: '1. Quán triệt của Chủ trì cuộc họp: ', bold: true }),
              new TextRun({
                text:
                  opening_statement ||
                  'Chưa có dữ liệu phát biểu khai mạc.',
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: '2. Ý kiến phát biểu và thảo luận của các thành viên dự họp:', bold: true }),
            ],
          }),

          // Danh sách các ý kiến phát biểu
          ...(discussions && discussions.length > 0
            ? discussions.map(
                (item, idx) =>
                  new Paragraph({
                    indent: { left: convertMillimetersToTwip(12) },
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: `- Nội dung ${idx + 1} (${item.speaker || 'Thành viên'}${item.role ? ` - ${item.role}` : ''}): `,
                        bold: true,
                      }),
                      new TextRun({ text: item.content }),
                    ],
                  })
              )
            : [
                new Paragraph({
                  indent: { left: convertMillimetersToTwip(12) },
                  children: [
                    new TextRun({
                      text: 'Chưa có dữ liệu ý kiến thảo luận.',
                      italics: true,
                    }),
                  ],
                }),
              ]),

          // 6. IV. KẾT LUẬN CỦA CHỦ TRÌ CUỘC HỌP
          new Paragraph({
            spacing: { before: 140, after: 60 },
            children: [
              new TextRun({
                text: 'IV. KẾT LUẬN CỦA CHỦ TRÌ CUỘC HỌP',
                bold: true,
                size: 26,
              }),
            ],
          }),
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            children: [
              new TextRun({
                text: 'Nội dung kết luận được ghi nhận từ nguồn cuộc họp:',
              }),
            ],
          }),

          // Danh sách các kết luận
          ...(conclusions && conclusions.length > 0
            ? conclusions.map(
                (c, idx) =>
                  new Paragraph({
                    indent: { left: convertMillimetersToTwip(12) },
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({ text: `${idx + 1}. `, bold: true }),
                      new TextRun({ text: c }),
                    ],
                  })
              )
            : [
                new Paragraph({
                  indent: { left: convertMillimetersToTwip(12) },
                  children: [
                    new TextRun({ text: 'Chưa có dữ liệu kết luận của chủ trì.' }),
                  ],
                }),
              ]),

          // 7. BẢNG PHÂN CÔNG NHIỆM VỤ
          new Paragraph({
            indent: { left: convertMillimetersToTwip(10) },
            spacing: { before: 100, after: 80 },
            children: [
              new TextRun({ text: 'Bảng phân công trách nhiệm và tiến độ thực hiện:', bold: true }),
            ],
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              // Header Row
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({
                    width: { size: 8, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'STT', bold: true, size: 24 })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 45, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'Nội dung nhiệm vụ / Sản phẩm đầu ra', bold: true, size: 24 })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 27, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'Đơn vị / Người thực hiện', bold: true, size: 24 })],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'Thời hạn hoàn thành', bold: true, size: 24 })],
                      }),
                    ],
                  }),
                ],
              }),
              // Data rows
              ...(tasks && tasks.length > 0
                ? tasks.map(
                    (t, i) =>
                      new TableRow({
                        children: [
                          new TableCell({
                            children: [
                              new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: `${i + 1}`, size: 24 })],
                              }),
                            ],
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [
                                  new TextRun({ text: t.task_name, bold: true, size: 24 }),
                                  ...(t.requirements ? [new TextRun({ text: `\nYêu cầu: ${t.requirements}`, size: 22 })] : []),
                                ],
                              }),
                            ],
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                children: [new TextRun({ text: t.assigned_unit || 'Chưa xác định', size: 24 })],
                              }),
                            ],
                          }),
                          new TableCell({
                            children: [
                              new Paragraph({
                                alignment: AlignmentType.CENTER,
                                children: [new TextRun({ text: t.deadline || 'Chưa xác định', size: 24 })],
                              }),
                            ],
                          }),
                        ],
                      })
                  )
                : [
                    new TableRow({
                      children: [
                        new TableCell({
                          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('1')] })],
                        }),
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun('Hoàn thiện văn bản kết luận cuộc họp trình Hiệu trưởng ký')] })],
                        }),
                        new TableCell({
                          children: [new Paragraph({ children: [new TextRun('Văn phòng Trường')] })],
                        }),
                        new TableCell({
                          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('Trong vòng 02 ngày')] })],
                        }),
                      ],
                    }),
                  ]),
            ],
          }),

          // 8. KẾT THÚC BIÊN BẢN
          new Paragraph({
            spacing: { before: 180, after: 120 },
            children: [
              new TextRun({
                text:
                  closing_statement || 'Chưa có dữ liệu kết thúc hoặc thông qua biên bản.',
                italics: true,
              }),
            ],
          }),

          // 9. SIGNATURES TABLE (THƯ KÝ BÊN TRÁI - CHỦ TRÌ BÊN PHẢI)
          new Paragraph({ spacing: { before: 120, after: 60 }, children: [] }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  // THƯ KÝ
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: 'THƯ KÝ CUỘC HỌP', bold: true, size: 26 })],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 24 })],
                      }),
                      new Paragraph({ spacing: { before: 400, after: 400 }, children: [] }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: metadata.secretary_name || metadata.secretary || 'Chưa khai báo thư ký',
                            bold: true,
                            size: 26,
                          }),
                        ],
                      }),
                    ],
                  }),
                  // CHỦ TRÌ (HIỆU TRƯỞNG)
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: (metadata.chair_title || 'CHỦ TRÌ CUỘC HỌP').toUpperCase(),
                            bold: true,
                            size: 26,
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: '(Ký và ghi rõ họ tên)', italics: true, size: 24 })],
                      }),
                      new Paragraph({ spacing: { before: 400, after: 400 }, children: [] }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: metadata.chair_name || metadata.chair || 'Chưa khai báo chủ trì',
                            bold: true,
                            size: 26,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // 10. NƠI NHẬN (Chuẩn Nghị định 30)
          new Paragraph({ spacing: { before: 180, after: 40 }, children: [] }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Nơi nhận:', bold: true, italics: true, size: 22 }),
            ],
          }),
          new Paragraph({
            children: [new TextRun({ text: '- Ban Giám hiệu (để báo cáo);', size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: '- Các đơn vị trực thuộc (để thực hiện);', size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: '- Lưu: VT, Hồ sơ cuộc họp.', size: 22 })],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export function downloadWordDocument(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
