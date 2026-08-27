import { MemberUploadStudio } from "@/components/member-upload-studio";
import { DEMO_MODE } from "@/lib/config";
import "./upload.css";
import "./upload-redesign.css";
import "./reference-upload.css";
import "./reference-upload-fixes.css";
import "./reference-upload-alignment.css";
import "./reference-upload-overflow.css";

export default function UploadPage() {
  return (
    <div className="member-upload-page reference-upload-page">
      <header className="member-upload-intro reference-upload-intro">
        <p>ADD TO OUR ARCHIVE</p>
        <h1>
          把你记得的，也放进来<span aria-hidden="true">⌁</span>
        </h1>
        <small>上传后由管理员确认，再加入班级相册</small>
      </header>
      <MemberUploadStudio demoMode={DEMO_MODE} />
    </div>
  );
}
