import { MemberUploadStudio } from "@/components/member-upload-studio";
import { DEMO_MODE } from "@/lib/config";
import "./upload.css";

export default function UploadPage() {
  return (
    <div className="member-upload-page">
      <header className="member-upload-intro">
        <div>
          <p>
            <span /> ADD TO OUR ARCHIVE
          </p>
          <h1>
            把你记得的，
            <br />
            <em>也放进来</em>
          </h1>
        </div>
        <div className="member-upload-guidance">
          <b>每一张照片都先经过确认</b>
          <p>
            上传后不会立刻公开。管理员会检查内容和可见范围，通过后才会出现在班级相册。
          </p>
          <ol>
            <li>
              <span>01</span>选择照片并补充故事
            </li>
            <li>
              <span>02</span>安全上传到私有存储
            </li>
            <li>
              <span>03</span>管理员审核后展示
            </li>
          </ol>
        </div>
      </header>
      <MemberUploadStudio demoMode={DEMO_MODE} />
    </div>
  );
}
