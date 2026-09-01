import CustomerPortal from "../../customer-portal";

export default async function CustomerReportOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerPortal view="orderDetail" orderId={Number(id)}/>;
}
