import Foundation
import HitSlopRuntime

func testRequest(_ open: FixtureJSON, ops: [FixtureJSON], id: String = UUID().uuidString)
  -> FixtureJSON
{
  var request = open["snapshot"].object
  request.removeValue(forKey: "revision")
  request.removeValue(forKey: "data")
  request["leaseId"] = open["lease"]["id"]
  request["requestId"] = .string(id)
  request["ops"] = .array(ops)
  return .object(request)
}
func testSet(_ key: String, _ value: FixtureJSON) -> FixtureJSON {
  .object(["op": .string("set"), "path": .array([.object(["key": .string(key)])]), "value": value])
}
