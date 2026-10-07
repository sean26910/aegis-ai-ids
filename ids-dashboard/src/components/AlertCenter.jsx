function AlertCenter({ alerts }) {
  return (
    <div className="mt-8 bg-white rounded-2xl shadow p-6">

      <h3 className="text-lg font-semibold mb-4">
        最新異常事件
      </h3>

      <div className="max-h-[500px] overflow-y-auto pr-2">
        <div className="space-y-4">

          {alerts.slice(0, 5).map((alert, index) => (
            <div
              key={index}
              className="border-l-4 border-red-500 bg-red-50 rounded-lg p-4"
            >

              <div className="flex justify-between items-center">

                <div>

                  <h4 className="font-semibold text-slate-800 text-lg">
                    {alert.prediction}
                  </h4>

                  <p className="text-sm text-slate-600 mt-1">
                    來源 IP：{alert.src_ip}
                  </p>

                  <p className="text-sm text-slate-600">
                    目的埠：{alert.dst_port}
                  </p>

                </div>

                <div className="text-right">

                  <p className="text-sm text-slate-500">
                    偵測時間
                  </p>

                  <p className="font-medium text-slate-700">
                    {alert.captured_at}
                  </p>

                </div>

              </div>

            </div>
          ))}

        </div>
      </div>
    </div>
  );
}

export default AlertCenter;