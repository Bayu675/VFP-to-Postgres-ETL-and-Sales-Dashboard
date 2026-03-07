import { DataGrid, GridColDef, GridRowsProp } from '@mui/x-data-grid';

// Strict TS: Interface untuk props komponen
interface TableGridProps {
  rows: GridRowsProp;
  columns: GridColDef[];
  loading?: boolean;
}

export const TableGrid = ({ rows, columns, loading = false }: TableGridProps) => {
  return (
    <div className="bg-white rounded-lg shadow-md w-full h-[600px]">
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        // Custom pagination biar kayak Excel
        initialState={{
          pagination: { paginationModel: { pageSize: 100 } },
        }}
        pageSizeOptions={[25, 50, 100, 500]}
        disableRowSelectionOnClick
        density="compact" // Biar barisnya rapet kayak Excel
        sx={{
          border: 'none',
          '& .MuiDataGrid-cell': {
            borderBottom: '1px solid #f0f0f0',
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#f8fafc',
            borderBottom: '2px solid #e2e8f0',
            fontWeight: 'bold',
          },
        }}
      />
    </div>
  );
};