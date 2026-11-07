import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Briefcase,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import { HomeRecipeLogo } from '../components/HomeRecipeLogo.tsx';
import { idCardService } from '../services/firebaseServices.ts';

interface PublicVerificationViewProps {
  employeeCode: string;
  onNavigateHome?: () => void;
}

export const PublicVerificationView: React.FC<PublicVerificationViewProps> = ({
  employeeCode,
  onNavigateHome,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    idCardService
      .verifyPublicEmployee(employeeCode)
      .then((res) => {
        if (!active) return;
        if (res.found) {
          setData(res);
        } else {
          setError(res.message || 'এই আইডি কার্ডের তথ্য খুঁজে পাওয়া যায়নি।');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'যাচাইকরণ সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [employeeCode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F3E8D6] via-[#FFF9EF] to-[#E9DCB8] text-[#38251D] flex flex-col justify-between p-4 sm:p-6 font-sans">
      {/* Brand Header */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between pb-5 border-b border-[#D6B477]/40">
        <HomeRecipeLogo size="sm" variant="dark" />
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#38251D] border border-[#D6B477] rounded-full text-[#FFF9EF] text-xs font-semibold shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-[#D6B477]" />
          <span>অফিসিয়াল ভেরিফিকেশন</span>
        </div>
      </header>

      {/* Main Verification Card */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        {loading ? (
          <div className="bg-[#FFF9EF] border border-[#D6B477]/60 rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full border-4 border-[#8B6348] border-t-transparent animate-spin mx-auto" />
            <div className="text-sm font-bold text-[#38251D]">
              কর্মচারী তথ্য যাচাই করা হচ্ছে...
            </div>
            <div className="text-xs text-[#493025]">
              সুরক্ষিত ডেটাবেজের সাথে আইডি কোড মিলানো হচ্ছে
            </div>
          </div>
        ) : error || !data ? (
          <div className="bg-[#FFF9EF] border border-amber-300 rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-full bg-[#F3E8D6] border border-[#8B6348] flex items-center justify-center mx-auto text-[#493025]">
              <XCircle className="w-8 h-8 text-[#8B6348]" />
            </div>
            <h2 className="text-lg font-bold text-[#38251D]">কার্ড যাচাই ব্যর্থ হয়েছে</h2>
            <p className="text-xs text-[#493025] leading-relaxed max-w-xs mx-auto">
              {error || 'প্রদত্ত আইডি কার্ডের বিপরীতে কোনো রেকর্ড সিস্টেমে পাওয়া যায়নি।'}
            </p>
            <div className="p-3 bg-[#F3E8D6]/70 border border-[#D6B477]/40 rounded-xl text-left text-xs text-[#38251D] space-y-1">
              <div className="font-semibold text-[#493025]">যাচাইকৃত কোড:</div>
              <div className="font-mono text-[#38251D] font-bold tracking-wider">{employeeCode}</div>
              <div className="text-[11px] text-[#624331] mt-1">
                কার্ডটি জাল বা বাতিল হতে পারে। অনুগ্রহ করে হোম রেসিপি ফুডস্ কর্তৃপক্ষের সাথে যোগাযোগ করুন।
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#FFF9EF] border border-[#D6B477]/60 rounded-2xl overflow-hidden shadow-xl ring-1 ring-[#38251D]/15">
            {/* Verification Status Banner (Luxury Dark Coffee Header) */}
            <div
              className={`px-6 py-4 flex items-center justify-between border-b border-[#D6B477] ${
                data.isValid
                  ? 'bg-gradient-to-r from-[#38251D] via-[#493025] to-[#38251D] text-[#FFF9EF]'
                  : 'bg-gradient-to-r from-[#493025] via-[#8B6348] to-[#493025] text-[#FFF9EF]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {data.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-[#D6B477] shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-[#D6B477] shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#FFF9EF]">
                    {data.isValid ? 'বৈধ আইডি কার্ড (VERIFIED)' : 'নিষ্ক্রিয় বা বাতিল কার্ড'}
                  </div>
                  <div className="text-[11px] text-[#F3E8D6]">
                    Home Recipe Foods Authorized Employee
                  </div>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                  data.isValid
                    ? 'bg-[#8B6348] border-[#D6B477] text-white'
                    : 'bg-[#38251D] border-[#D6B477] text-[#F3E8D6]'
                }`}
              >
                {data.employmentStatus}
              </span>
            </div>

            {/* Employee Profile Preview */}
            <div className="p-6 space-y-6">
              {/* Photo & Name */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full p-[2.5px] bg-gradient-to-tr from-[#D6B477] via-[#8B6348] to-[#38251D] shadow-md">
                    <div className="w-full h-full rounded-full p-[2px] bg-[#FFF9EF] overflow-hidden">
                      {data.photoUrl ? (
                        <img
                          src={data.photoUrl}
                          alt={data.fullName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-[#F3E8D6] flex items-center justify-center text-[#38251D] font-black text-xl">
                          {data.fullName.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>
                  {data.isValid && (
                    <div className="absolute -bottom-1 -right-1 p-1 bg-[#38251D] border border-[#D6B477] rounded-full text-[#D6B477] shadow-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-black text-[#38251D] truncate uppercase">{data.fullName}</h1>
                  <div className="text-xs text-[#8B6348] font-bold truncate flex items-center gap-1.5 mt-0.5">
                    <Briefcase className="w-3.5 h-3.5 shrink-0" />
                    <span>{data.designationName}</span>
                  </div>
                  <div className="text-xs text-[#493025] font-medium truncate flex items-center gap-1.5 mt-1">
                    <Building2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{data.departmentName} বিভাগ</span>
                  </div>
                </div>
              </div>

              {/* Data Verification Table (Strictly Non-Sensitive Data) */}
              <div className="bg-[#F3E8D6]/60 border border-[#D6B477]/40 rounded-xl p-4 divide-y divide-[#D6B477]/30 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#493025] font-semibold">কর্মচারী আইডি (ID No)</span>
                  <span className="font-mono font-bold text-[#38251D] tracking-wider text-sm">
                    {data.employeeCode}
                  </span>
                </div>

                {data.bloodGroup && (
                  <div className="py-2 flex items-center justify-between">
                    <span className="text-[#493025] font-semibold">রক্তের গ্রুপ (Blood Group)</span>
                    <span className="font-extrabold px-2 py-0.5 rounded bg-[#FFF9EF] border border-[#8B6348] text-[#8B6348] shadow-2xs">
                      {data.bloodGroup}
                    </span>
                  </div>
                )}

                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#493025] font-semibold">যোগদানের তারিখ (Joining Date)</span>
                  <span className="font-mono text-[#38251D] font-medium">{data.joiningDate || '-'}</span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#493025] font-semibold">আইডি কার্ডের মেয়াদ (Valid Until)</span>
                  <span className="font-mono font-bold text-[#8B6348]">
                    {data.expireDate || '-'}
                  </span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#493025] font-semibold">প্রতিষ্ঠান (Organization)</span>
                  <span className="font-bold text-[#38251D] text-right">
                    {data.companyName}
                  </span>
                </div>
              </div>

              {/* Privacy and Security Seal Note */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FFF9EF] border border-[#D6B477]/30 text-[11px] text-[#493025] leading-relaxed">
                <Lock className="w-4 h-4 text-[#8B6348] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-[#38251D]">নিরাপত্তা ও গোপনীয়তা নিশ্চিত: </span>
                  নিরাপত্তা বিধিমালার কারণে কর্মচারীর জাতীয় পরিচয়পত্র (NID), ব্যক্তিগত ঠিকানা ও স্পর্শকাতর তথ্য জনসম্মুখে প্রদর্শন করা হয় না।
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Back Link / Action */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              if (onNavigateHome) {
                onNavigateHome();
              } else {
                window.location.href = '/';
              }
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#8B6348] hover:text-[#38251D] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>হোম রেসিপি ফুডস্ সিস্টেমে যান</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto pt-6 border-t border-[#D6B477]/40 text-center text-xs text-[#624331]">
        <div className="font-medium">© {new Date().getFullYear()} Home Recipe Foods. All rights reserved.</div>
        <div className="text-[11px] text-[#8B6348] mt-1">
          চট্টগ্রাম, বাংলাদেশ · অফিসিয়াল কর্মচারী পরিচয়পত্র যাচাইকরণ পোর্টাল
        </div>
      </footer>
    </div>
  );
};
