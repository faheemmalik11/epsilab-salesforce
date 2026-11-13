import { Navigate, Route, Routes, useParams } from 'react-router';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { ListPage } from './pages/ListPage';
import { RecordPage } from './pages/RecordPage';
import { StubPage } from './pages/StubPage';
import { layoutFor, type TabObject } from './lib/layouts';

function ObjectList() {
  const { object = '' } = useParams();
  return layoutFor(object) ? <ListPage key={object} object={object as TabObject} /> : <Navigate to="/lightning/page/home" replace />;
}

function ObjectRecord() {
  const { object = '', id = '' } = useParams();
  return layoutFor(object) ? <RecordPage key={`${object}/${id}`} /> : <Navigate to="/lightning/page/home" replace />;
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/lightning/page/home" element={<HomePage />} />
        <Route path="/lightning/o/:object/list" element={<ObjectList />} />
        <Route path="/lightning/r/:object/:id/view" element={<ObjectRecord />} />
        <Route path="/lightning/stub/:slug" element={<StubPage />} />
        <Route path="*" element={<Navigate to="/lightning/page/home" replace />} />
      </Routes>
    </AppShell>
  );
}
