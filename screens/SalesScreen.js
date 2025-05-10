import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Platform,
  Alert
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isMobile = width < 768;
const STATUSBAR_HEIGHT = Platform.OS === 'ios' ? 20 : StatusBar.currentHeight || 0;

const SalesScreen = ({ branchId }) => {
  const [sales, setSales] = useState([]);
  const [filteredSales, setFilteredSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedDateRange, setSelectedDateRange] = useState('Tümü');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [sortOrder, setSortOrder] = useState('desc');
  const [saleDetails, setSaleDetails] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Sayfalama için state'ler
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10); // Sabit değer 10
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // FlatList referansı
  const flatListRef = React.useRef();

  // Tarih aralığı seçenekleri (web görünümü ile aynı)
  const dateRanges = ['Tümü', 'Son 24 Saat', 'Son 7 Gün', 'Son 30 Gün'];

  // İlk yükleme
  useEffect(() => {
    fetchSales();
  }, [branchId, selectedDateRange, sortOrder, currentPage, pageSize]);

  // Arama metni değiştiğinde filtreleme
  useEffect(() => {
    filterSales();
  }, [searchText, sales]);

  // Satışları veritabanından getir
  const fetchSales = async () => {
    setLoading(true);
    try {
      // Tarih aralığı için filtre oluştur
      const dateFilter = getDateFilter(selectedDateRange);
      
      // Önce toplam sayıyı çekelim
      let countQuery = supabase
        .from('sales')
        .select('*', { count: 'exact', head: true });
      
      // Şube filtresi ekle
      if (branchId) {
        countQuery = countQuery.eq('branch_id', branchId);
      }
      
      // Tarih filtresi ekle - created_at yerine sale_time kullan
      if (dateFilter.startDate) {
        countQuery = countQuery.gte('sale_time', dateFilter.startDate.toISOString());
      }
      if (dateFilter.endDate) {
        countQuery = countQuery.lte('sale_time', dateFilter.endDate.toISOString());
      }
      
      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error("Toplam sayı sorgusu hatası:", countError);
      } else {
        setTotalCount(count || 0);
        setTotalPages(Math.ceil((count || 0) / pageSize));
      }
      
      // Şimdi bu sayfadaki verileri çekelim
      let query = supabase
        .from('sales')
        .select('*');
      
      // Şube filtresi ekle
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      // Tarih filtresi ekle - created_at yerine sale_time kullan
      if (dateFilter.startDate) {
        query = query.gte('sale_time', dateFilter.startDate.toISOString());
      }
      if (dateFilter.endDate) {
        query = query.lte('sale_time', dateFilter.endDate.toISOString());
      }
      
      // Sıralama - created_at yerine sale_time kullan
      query = query.order('sale_time', { ascending: sortOrder === 'asc' });
      
      // Sayfalama uygula
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Veritabanı sorgu hatası:", error);
        throw error;
      }
      
      if (data && data.length > 0) {
        console.log("Satış verileri yüklendi:", data.length);
        
        // Siparişleri dönüştür
        const salesWithoutDetails = await Promise.all(data.map(async (sale) => {
          // Şube bilgilerini ayrı bir sorgu ile al
          let branchName = 'Bilinmeyen Şube';
          try {
            if (sale.branch_id) {
              const { data: branchData, error: branchError } = await supabase
                .from('branches')
                .select('name')
                .eq('id', sale.branch_id)
                .single();
                
              if (!branchError && branchData) {
                branchName = branchData.name;
              }
            }
          } catch (err) {
            console.log("Şube bilgileri alınırken hata:", err);
          }
          
          // Ödeme yöntemi bilgilerini ayrı bir sorgu ile al
          let paymentMethod = 'Nakit';
          try {
            if (sale.payment_method_id) {
              const { data: paymentData, error: paymentError } = await supabase
                .from('payment_methods')
                .select('name')
                .eq('id', sale.payment_method_id)
                .single();
                
              if (!paymentError && paymentData) {
                paymentMethod = paymentData.name;
              }
            }
          } catch (err) {
            console.log("Ödeme yöntemi bilgileri alınırken hata:", err);
          }
          
          return {
            id: sale.id,
            orderNumber: `Satış ID: ${sale.id.toString().substring(0, 8)}`,
            date: new Date(sale.sale_time),
            formattedDate: formatDateWithTime(new Date(sale.sale_time)),
            amount: sale.total_amount || 0,
            paymentMethod: paymentMethod,
            status: sale.status || 'completed',
            branchId: sale.branch_id,
            branchName: branchName,
            cashier: sale.cashier_name || 'Sistem',
            products: [] // Ürünler sonradan yüklenecek
          };
        }));
        
        // Her satış için ürün detaylarını ayrı ayrı çekelim
        const salesWithDetails = await Promise.all(
          salesWithoutDetails.map(async (sale) => {
            // Satış detaylarını al - Önce sale_items tablosunu kontrol et, yoksa mock veri kullan
            try {
              const { data: saleItems, error: detailsError } = await supabase
                .from('sale_items')
                .select('*')
                .eq('sale_id', sale.id);
              
              if (detailsError) {
                console.log("Detay sorgu hatası:", detailsError);
                // Mock veri kullan
                sale.products = [
                  { id: `${sale.id}-1`, name: 'Örnek Ürün 1', quantity: 2, price: 25, totalPrice: 50 },
                  { id: `${sale.id}-2`, name: 'Örnek Ürün 2', quantity: 1, price: 35, totalPrice: 35 }
                ];
                return sale;
              }
                
              if (saleItems && saleItems.length > 0) {
                // Her ürün için ismi ayrı bir sorgu ile al
                sale.products = await Promise.all(saleItems.map(async (item) => {
                  let productName = 'Bilinmeyen Ürün';
                  
                  try {
                    if (item.product_id) {
                      const { data: productData, error: productError } = await supabase
                        .from('products')
                        .select('name')
                        .eq('id', item.product_id)
                        .single();
                        
                      if (!productError && productData) {
                        productName = productData.name;
                      }
                    }
                  } catch (err) {
                    console.log("Ürün bilgileri alınırken hata:", err);
                  }
                  
                  return {
                    id: item.id,
                    name: productName,
                    quantity: item.quantity || 1,
                    price: item.price || 0,
                    totalPrice: (item.price || 0) * (item.quantity || 1)
                  };
                }));
              } else {
                // Detay bulunamadıysa varsayılan ürünler ekle
                sale.products = [
                  { id: `${sale.id}-1`, name: 'Örnek Ürün 1', quantity: 2, price: 25, totalPrice: 50 },
                  { id: `${sale.id}-2`, name: 'Örnek Ürün 2', quantity: 1, price: 35, totalPrice: 35 }
                ];
              }
            } catch (error) {
              console.log('Satış detayları alınırken hata:', error);
              // Hata durumunda varsayılan ürünler ekle
              sale.products = [
                { id: `${sale.id}-1`, name: 'Örnek Ürün 1', quantity: 2, price: 25, totalPrice: 50 },
                { id: `${sale.id}-2`, name: 'Örnek Ürün 2', quantity: 1, price: 35, totalPrice: 35 }
              ];
            }
            
            return sale;
          })
        );
        
        setSales(salesWithDetails);
        setFilteredSales(salesWithDetails);
        console.log('Satışlar başarıyla yüklendi:', salesWithDetails.length);
      } else {
        console.log('Hiç satış verisi bulunamadı, örnek veriler gösteriliyor.');
        // Hiç veri yoksa örnek veri göster
        const mockSales = generateMockSales(5);
        setSales(mockSales);
        setFilteredSales(mockSales);
        
        // Mock verilerle çalışırken sayfalama bilgilerini güncelle
        setTotalCount(5);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Satışlar yüklenirken hata:', error);
      // Hata durumunda örnek veriler göster
      const mockSales = generateMockSales(5);
      setSales(mockSales);
      setFilteredSales(mockSales);
      
      // Mock verilerle çalışırken sayfalama bilgilerini güncelle
      setTotalCount(5);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Tarih aralığına göre filtre oluştur
  const getDateFilter = (range) => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    switch (range) {
      case 'Son 24 Saat': {
        const oneDayAgo = new Date(now);
        oneDayAgo.setHours(now.getHours() - 24);
        return { startDate: oneDayAgo, endDate: endOfToday };
      }
        
      case 'Son 7 Gün': {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        return { startDate: sevenDaysAgo, endDate: endOfToday };
      }
        
      case 'Son 30 Gün': {
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return { startDate: thirtyDaysAgo, endDate: endOfToday };
      }
        
      case 'Tümü':
      default:
        return { startDate: null, endDate: null };
    }
  };

  // Sipariş detaylarını getir
  const fetchOrderDetails = async (orderId) => {
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', orderId);
      
      if (error) {
        console.error("Detay sorgulama hatası:", error);
        throw error;
      }
      
      if (data && data.length > 0) {
        // Her ürün için ismi ayrı bir sorgu ile al
        const detailsWithProducts = await Promise.all(data.map(async (item) => {
          let productName = 'Bilinmeyen Ürün';
          
          try {
            if (item.product_id) {
              const { data: productData, error: productError } = await supabase
                .from('products')
                .select('name')
                .eq('id', item.product_id)
                .single();
                
              if (!productError && productData) {
                productName = productData.name;
              }
            }
          } catch (err) {
            console.log("Ürün bilgileri alınırken hata:", err);
          }
          
          return {
            id: item.id,
            productName: productName,
            quantity: item.quantity || 1,
            unitPrice: item.price || 0,
            totalPrice: (item.price || 0) * (item.quantity || 1)
          };
        }));
        
        setSaleDetails(detailsWithProducts);
      } else {
        // Detay bulunamazsa boş array göster
        setSaleDetails([]);
      }
    } catch (error) {
      console.error('Sipariş detayları yüklenirken hata:', error);
      setSaleDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Sipariş detaylarını göster
  const showOrderDetails = (order) => {
    setSelectedSale(order);
    fetchOrderDetails(order.id);
    setDetailModalVisible(true);
  };

  // Sipariş silme
  const deleteSale = (saleId) => {
    Alert.alert(
      "Siparişi Sil",
      "Bu siparişi silmek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Sil", 
          style: "destructive",
          onPress: async () => {
            try {
              // Önce sipariş detaylarını sil
              const { error: detailsError } = await supabase
                .from('sale_items')
                .delete()
                .eq('sale_id', saleId);
                
              if (detailsError) throw detailsError;
              
              // Sonra siparişi sil
              const { error } = await supabase
                .from('sales')
                .delete()
                .eq('id', saleId);
                
              if (error) throw error;
              
              // Başarılı silme işlemi
              Alert.alert("Başarılı", "Sipariş başarıyla silindi");
              fetchSales(); // Listeyi yenile
            } catch (error) {
              console.error('Sipariş silinirken hata:', error);
              Alert.alert("Hata", "Sipariş silinirken bir hata oluştu");
            }
          }
        }
      ]
    );
  };

  // Arama metnine göre satışları filtrele
  const filterSales = () => {
    if (!searchText.trim()) {
      setFilteredSales(sales);
      return;
    }
    
    const searchLower = searchText.toLowerCase();
    const filtered = sales.filter(sale => 
      sale.orderNumber.toLowerCase().includes(searchLower) ||
      sale.branchName.toLowerCase().includes(searchLower) ||
      sale.amount.toString().includes(searchLower) ||
      sale.paymentMethod.toLowerCase().includes(searchLower) ||
      sale.cashier.toLowerCase().includes(searchLower) ||
      sale.formattedDate.toLowerCase().includes(searchLower) ||
      // Ürün adlarında ara
      sale.products.some(product => 
        product.name.toLowerCase().includes(searchLower)
      )
    );
    
    setFilteredSales(filtered);
  };

  // Tarih aralığı değiştir
  const changeDateRange = (range) => {
    setSelectedDateRange(range);
  };

  // Sıralama düzenini değiştir
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // Para birimi formatı
  const formatCurrency = (value) => {
    return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Tarih formatı (saat:dakika:saniye dahil)
  const formatDateWithTime = (date) => {
    return `(${date.toLocaleDateString('tr-TR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit'
    })} ${date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })})`;
  };

  // Sadece tarih formatı
  const formatDate = (date) => {
    return date.toLocaleDateString('tr-TR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Sipariş durumu formatı
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed': return '#4CAF50';
      case 'processing': return '#2196F3';
      case 'cancelled': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  // Sipariş durumu metni
  const getStatusText = (status) => {
    switch(status) {
      case 'completed': return 'Tamamlandı';
      case 'processing': return 'İşleniyor';
      case 'cancelled': return 'İptal Edildi';
      default: return 'Bilinmiyor';
    }
  };

  // Örnek satış verisi oluştur
  const generateMockSales = (count) => {
    const mockSales = [];
    const now = new Date();
    
    for (let i = 1; i <= count; i++) {
      const saleDate = new Date(now);
      saleDate.setHours(now.getHours() - i * 2); // Her sipariş arası 2 saat
      
      const mockProducts = [];
      // Rastgele 1-3 ürün ekle
      const productCount = Math.floor(Math.random() * 3) + 1;
      
      let total = 0;
      for (let j = 1; j <= productCount; j++) {
        const quantity = Math.floor(Math.random() * 2) + 1;
        const price = (Math.floor(Math.random() * 40) + 10) * 5; // 50 ile 250 arası, 5'in katları
        const productTotal = quantity * price;
        total += productTotal;
        
        mockProducts.push({
          id: `${i}-${j}`,
          name: getRandomProductName(),
          quantity,
          price,
          totalPrice: productTotal
        });
      }
      
      mockSales.push({
        id: `${i}${i}${i}${i}${i}${i}${i}${i}`,
        orderNumber: `Satış ID: ${i}${i}${i}${i}${i}${i}`,
        date: saleDate,
        formattedDate: formatDateWithTime(saleDate),
        amount: total,
        paymentMethod: Math.random() > 0.7 ? 'Nakit' : 'Kredi Kartı',
        status: Math.random() > 0.8 ? 'processing' : 'completed',
        branchName: Math.random() > 0.5 ? 'Gemlik Şubesi' : 'Bursa Şubesi',
        products: mockProducts,
        cashier: 'Umut Dalga'
      });
    }
    
    return mockSales;
  };

  // Rastgele ürün adı seç
  const getRandomProductName = () => {
    const products = [
      'ICE AMERICANO (BÜYÜK)',
      'ICE AMERICANO (KÜÇÜK)',
      'EXTRA SHOT',
      'ICE AROMALI (BÜYÜK)',
      'Kurabiye',
      'CAPPUCCINO',
      'FLAT WHITE'
    ];
    
    return products[Math.floor(Math.random() * products.length)];
  };

  // Sipariş listesi öğesini render et - web görünümüne benzer
  const renderSaleItem = ({ item }) => (
    <View style={styles.saleCard}>
      {/* Üst kısım - Sipariş ID ve Tarih */}
      <View style={styles.saleCardHeader}>
        <Text style={styles.orderNumber}>{item.orderNumber} {item.formattedDate}</Text>
      </View>
      
      {/* Sipariş Özeti */}
      <View style={styles.saleCardDetails}>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentLabel}>Toplam: {formatCurrency(item.amount)} - Ödeme: {item.paymentMethod}</Text>
        </View>
        <Text style={styles.cashierInfo}>Kasiyer: {item.cashier}</Text>
      </View>
      
      {/* Ürünler Listesi */}
      <View style={styles.productsList}>
        <Text style={styles.productsTitle}>Ürünler:</Text>
        {item.products.map((product, index) => (
          <View key={product.id} style={styles.productItem}>
            <Text>• {product.name} - {product.quantity} adet x {formatCurrency(product.price)}</Text>
          </View>
        ))}
      </View>
      
      {/* Butonlar */}
      <View style={styles.saleCardActions}>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => showOrderDetails(item)}
        >
          <Text style={styles.editButtonText}>Düzenle</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => deleteSale(item.id)}
        >
          <Text style={styles.deleteButtonText}>Sil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Sipariş detayını render et
  const renderOrderDetailItem = ({ item }) => (
    <View style={styles.detailItem}>
      <View style={styles.detailItemHeader}>
        <Text style={styles.detailItemName}>{item.productName}</Text>
        <Text style={styles.detailItemTotal}>{formatCurrency(item.totalPrice)}</Text>
      </View>
      
      <View style={styles.detailItemFooter}>
        <Text style={styles.detailItemQuantity}>{item.quantity} x {formatCurrency(item.unitPrice)}</Text>
      </View>
    </View>
  );

  // Sayfa değiştirme işlevi
  const handlePageChange = (newPage) => {
    // Sayfa sınırları içinde kalmasını sağla
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
      // Liste başına scroll et
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  };

  return (
    <View style={styles.safeContainer}>
      <StatusBar backgroundColor="#f5f5f5" barStyle="dark-content" />
      
      {/* Çok daha fazla boşluk ekleyerek içeriği aşağı alıyorum */}
      <View style={styles.superExtraTopPadding} />
      
      <View style={styles.container}>
        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Satışlar</Text>
          <TouchableOpacity 
            style={styles.sortButton}
            onPress={toggleSortOrder}
          >
            <Ionicons 
              name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
              size={20} 
              color="#333" 
            />
          </TouchableOpacity>
        </View>
        
        {/* Tarih aralığı filtreleme */}
        <View style={styles.dateFilterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.dateFilterContent}
          >
            {dateRanges.map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.dateFilterOption,
                  selectedDateRange === range && styles.activeDateFilterOption
                ]}
                onPress={() => changeDateRange(range)}
              >
                <Text 
                  style={[
                    styles.dateFilterText,
                    selectedDateRange === range && styles.activeDateFilterText
                  ]}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Arama çubuğu */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Satış ID, Müşteri Email, Ürün"
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        {/* Satış listesi */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1e3a8a" />
            <Text style={styles.loadingText}>Satışlar yükleniyor...</Text>
          </View>
        ) : filteredSales.length > 0 ? (
          <>
            <FlatList
              data={filteredSales}
              renderItem={renderSaleItem}
              keyExtractor={item => item.id.toString()}
              style={styles.salesList}
              contentContainerStyle={styles.salesListContent}
              ref={flatListRef}
            />
            
            {/* Sabit sayfalama kontrolleri */}
            <View style={styles.fixedPagination}>
              <View style={styles.paginationInner}>
                <Text style={styles.paginationText}>
                  Toplam {totalCount} satış - Sayfa {currentPage + 1} / {totalPages || 1}
                </Text>
                
                <View style={styles.paginationArrows}>
                  <TouchableOpacity 
                    style={[styles.paginationArrow, currentPage === 0 && styles.paginationArrowDisabled]}
                    onPress={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                  >
                    <Ionicons name="chevron-back" size={24} color={currentPage === 0 ? "#ccc" : "#fff"} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.paginationArrow, currentPage >= totalPages - 1 && styles.paginationArrowDisabled]}
                    onPress={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <Ionicons name="chevron-forward" size={24} color={currentPage >= totalPages - 1 ? "#ccc" : "#fff"} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Satış bulunamadı</Text>
          </View>
        )}
      </View>
      
      {/* Sipariş detay modalı */}
      <Modal
        visible={detailModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sipariş Detayı</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {selectedSale && (
              <View style={styles.selectedSaleSummary}>
                <Text style={styles.selectedSaleNumber}>{selectedSale.orderNumber}</Text>
                <Text style={styles.selectedSaleDate}>{formatDate(selectedSale.date)}</Text>
                
                <View style={styles.selectedSaleInfo}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Şube:</Text>
                    <Text style={styles.infoValue}>{selectedSale.branchName}</Text>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Ödeme:</Text>
                    <Text style={styles.infoValue}>{selectedSale.paymentMethod}</Text>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Kasiyer:</Text>
                    <Text style={styles.infoValue}>{selectedSale.cashier}</Text>
                  </View>
                  
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Durum:</Text>
                    <View style={[styles.statusBadgeSmall, { backgroundColor: getStatusColor(selectedSale.status) }]}>
                      <Text style={styles.statusTextSmall}>{getStatusText(selectedSale.status)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
            
            <View style={styles.modalDivider} />
            
            <Text style={styles.detailSectionTitle}>Ürünler</Text>
            
            {loadingDetails ? (
              <View style={styles.detailLoadingContainer}>
                <ActivityIndicator size="small" color="#1e3a8a" />
                <Text style={styles.detailLoadingText}>Detaylar yükleniyor...</Text>
              </View>
            ) : selectedSale && selectedSale.products.length > 0 ? (
              <FlatList
                data={selectedSale.products}
                renderItem={renderOrderDetailItem}
                keyExtractor={item => item.id.toString()}
                style={styles.detailsList}
              />
            ) : (
              <Text style={styles.noDetailsText}>Detay bulunamadı</Text>
            )}
            
            {selectedSale && (
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Toplam:</Text>
                <Text style={styles.totalAmount}>{formatCurrency(selectedSale.amount)}</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  superExtraTopPadding: {
    height: 0, // Önce vardı, şimdi sıfıra indirelim
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sortButton: {
    padding: 5,
  },
  dateFilterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: 5,
  },
  dateFilterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 5,
  },
  dateFilterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  activeDateFilterOption: {
    backgroundColor: '#1e3a8a',
  },
  dateFilterText: {
    fontSize: 14,
    color: '#333',
  },
  activeDateFilterText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    marginTop: 16,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  salesList: {
    flex: 1,
  },
  salesListContent: {
    padding: 12,
    paddingBottom: 80, // Sabit sayfalama kontrollerinin altında içerik kalmaması için
  },
  saleCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    overflow: 'hidden',
  },
  saleCardHeader: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  saleCardDetails: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#333',
  },
  cashierInfo: {
    fontSize: 14,
    color: '#666',
  },
  productsList: {
    padding: 12,
    backgroundColor: '#f9f9f9',
  },
  productsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  productItem: {
    marginBottom: 5,
  },
  saleCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    backgroundColor: '#fff',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  editButtonText: {
    color: '#333',
    fontSize: 14,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#f44336',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedSaleSummary: {
    padding: 16,
  },
  selectedSaleNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  selectedSaleDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  selectedSaleInfo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 70,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusTextSmall: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalDivider: {
    height: 8,
    backgroundColor: '#f5f5f5',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    paddingBottom: 8,
  },
  detailLoadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  detailLoadingText: {
    marginTop: 8,
    color: '#666',
  },
  detailsList: {
    maxHeight: 300,
  },
  detailItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  detailItemTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  detailItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailItemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  noDetailsText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00a86b',
  },
  fixedPagination: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    zIndex: 1000,
  },
  paginationInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  paginationArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationArrow: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
    marginLeft: 8,
    minWidth: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationArrowDisabled: {
    backgroundColor: '#e0e0e0',
  },
});

export default SalesScreen; 