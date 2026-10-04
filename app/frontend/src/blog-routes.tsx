import { Navigate, Route, Routes } from 'react-router-dom';
import BlogIndexPage from './pages/blog/BlogIndexPage';
import BlogPostPage from './pages/blog/BlogPostPage';

const BlogRoutes = () => (
  <Routes>
    <Route index element={<BlogIndexPage />} />
    <Route path=":slug" element={<BlogPostPage />} />
    <Route path="*" element={<Navigate to="/blog/" replace />} />
  </Routes>
);

export default BlogRoutes;
