// アプリの URL の QR コード画像を作る（macOS の CoreImage を使う）。
// 使い方: swift scripts/make-qr.swift https://lammratta.github.io/sg-study/ docs/qr-sg-study.png
import Foundation
import CoreImage
import AppKit

let message = CommandLine.arguments[1]
let out = CommandLine.arguments[2]
let filter = CIFilter(name: "CIQRCodeGenerator")!
filter.setValue(message.data(using: .utf8)!, forKey: "inputMessage")
filter.setValue("M", forKey: "inputCorrectionLevel")
let scale: CGFloat = 12
let qr = filter.outputImage!.samplingNearest().transformed(by: CGAffineTransform(scaleX: scale, y: scale))
let margin: CGFloat = 4 * scale
let size = CGSize(width: qr.extent.width + margin * 2, height: qr.extent.height + margin * 2)
let bg = CIImage(color: CIColor.white).cropped(to: CGRect(origin: .zero, size: size))
let composed = qr.transformed(by: CGAffineTransform(translationX: margin, y: margin)).composited(over: bg)
let cg = CIContext().createCGImage(composed, from: composed.extent)!
let png = NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])!
try png.write(to: URL(fileURLWithPath: out))

// 書き出した画像を読み戻して、正しい URL に復号できるか確かめる
let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
let decoded = detector.features(in: CIImage(contentsOf: URL(fileURLWithPath: out))!).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
print("size: \(Int(size.width))x\(Int(size.height)) decoded: \(decoded)")
if decoded != [message] { exit(1) }
