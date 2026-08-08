import sys

# Read the file
with open('src/pages/LocationsPage.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Content to insert before line 621 (index 620)
insert_content = '''
                    {/* ASN Statistics */}
                    {adminLocations.find(l => l.id === selectedLocationData.id)?.asnList && (
                      <>
                        <div className="bg-gradient-to-r from-gray-900 to-black text-white p-8 mb-12 rounded-lg">
                          <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                            <div className="w-1 h-8 bg-[#F20732]"></div>
                            Connected Networks
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/10 p-6 rounded-lg border-l-4 border-[#F20732]">
                              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Active ASNs</div>
                              <div className="text-5xl font-light text-white">
                                {admin Locations.find(l => l.id === selectedLocationData.id)?.asnList.filter(a => a.status === 'ACTIVE').length || 0}
                              </div>
                            </div>
                            <div className="bg-white/10 p-6 rounded-lg border-l-4 border-gray-300">
                              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Connecting ASNs</div>
                              <div className="text-5xl font-light text-white">
                                {adminLocations.find(l => l.id === selectedLocationData.id)?.asnList.filter(a => a.status === 'CONNECTING').length || 0}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ASN Table */}
                        <div className="bg-white p-8 shadow-sm border border-gray-200 mb-12">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-black text-black">Network ASNs</h3>
                            <input
                              type="text"
                              placeholder="Search ASN or name..."
                              value={asnSearch}
                              onChange={(e) => setASNSearch(e.target.value)}
                              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#F20732] font-mono text-sm"
                            />
                          </div>
                          
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="bg-gray-100 border-b-2 border-gray-300">
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">ASN</th>
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">Name</th>
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">Peering Policy</th>
                                  <th className="text-left px-4 py-3 font-mono text-xs uppercase tracking-wider text-gray-700">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {adminLocations.find(l => l.id === selectedLocationData.id)?.asnList
                                  .filter(asn => 
                                    asnSearch === '' || 
                                    asn.asnNumber.toString().includes(asnSearch) ||
                                    asn.name.toLowerCase().includes(asnSearch.toLowerCase())
                                  )
                                  .map((asn, idx) => (
                                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                      <td className="px-4 py-4 font-mono font-bold text-black">AS{asn.asnNumber}</td>
                                      <td className="px-4 py-4 text-gray-700">{asn.name}</td>
                                      <td className="px-4 py-4">
                                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-mono rounded">
                                          {asn.peeringPolicy}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4">
                                        <span className={`px-3 py-1 text-xs font-bold rounded ${
                                          asn.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                          asn.status === 'CONNECTING' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {asn.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Enabled Sites */}
                        <div className="bg-white p-8 shadow-sm border border-gray-200 mb-12">
                          <h3 className="text-2xl font-black text-black mb-6 flex items-center gap-3">
                            <div className="w-1 h-8 bg-[#F20732]"></div>
                            Enabled Data Centers
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {adminLocations.find(l => l.id === selectedLocationData.id)?.enabledSites.map((site) => (
                              <div key={site.id} className="border-2 border-gray-200 p-6 hover:border-[#F20732] transition-all duration-300 group">
                                <div className="flex items-start justify-between mb-4">
                                  <div>
                                    <h4 className="text-lg font-black text-black group-hover:text-[#F20732] transition-colors">
                                      {site.name}
                                    </h4>
                                    <div className="text-sm font-mono text-gray-500 mt-1">{site.provider}</div>
                                  </div>
                                  <span className={`px-3 py-1 text-xs font-bold rounded ${
                                    site.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    {site.status === 'available' ? 'AVAILABLE' : 'COMING SOON'}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-4">{site.address}</p>
                                <button 
                                  onClick={() => {
                                    const cityName = selectedLocationData.name.charAt(0) + selectedLocationData.name.slice(1).toLowerCase();
                                    window.dispatchEvent(new CustomEvent('navigateToContact', { 
                                      detail: { city: cityName, locationId: selectedLocationData.id, site: site.name } 
                                    }));
                                  }}
                                  className="w-full bg-black text-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider hover:bg-[#F20732] transition-colors flex items-center justify-center gap-2"
                                  disabled={site.status !== 'available'}
                                >
                                  {site.status === 'available' ? 'Get Connected' : 'Notify Me'}
                                  <span>→</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
'''

# Insert content at line 620 (before the Action Buttons comment)
lines.insert(620, insert_content)

# Write the file back
with open('src/pages/LocationsPage.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Successfully inserted sections")
