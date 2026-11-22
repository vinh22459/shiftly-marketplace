import MarketplaceApp from './MarketplaceApp'

// Dữ liệu việc làm mẫu hiển thị công khai cho khách
const mockJobs = [
  
]

export default function HomePage() {
  return (
    <MarketplaceApp
      initialJobs={mockJobs}
      initialAuth="guest"       // Đảm bảo luôn bắt đầu với tư cách khách
      initialAdminUsers={[]}
      initialAdminJobs={[]}
      initialAdminReviews={[]}
      initialApplications={[]}
      initialSavedJobs={[]}
      initialNotifications={[]}
      initialEmployerJobs={[]}
      initialUserName=""        // Không gán tên sẵn
    />
  )
}